"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Loader2, Share2, Sparkles, Square, SquareCheck, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MediaLibraryItem, MediaLibraryKind } from "@/lib/media-library-kinds";
import { MEDIA_LIBRARY_KIND_LABEL } from "@/lib/media-library-kinds";
import {
  createShareCollectionAction,
  deleteMediaLibraryItemAction,
  toggleMediaLibraryFeaturedAction,
} from "@/features/admin/media-library/actions";

interface MediaLibraryGridProps {
  eventId: string;
  items: MediaLibraryItem[];
}

const FILTERS: Array<{ label: string; kinds: MediaLibraryKind[] | null }> = [
  { label: "All", kinds: null },
  { label: "Gallery", kinds: ["gallery"] },
  { label: "Memory Wall", kinds: ["photo", "video", "audio"] },
  { label: "AI Images", kinds: ["ai_image"] },
  { label: "Slideshow Videos", kinds: ["slideshow_video"] },
  { label: "Video Edits", kinds: ["video_edit"] },
];

const FEATURABLE_KINDS: readonly MediaLibraryKind[] = ["photo", "video", "audio"];

function isPlayableImage(kind: MediaLibraryKind) {
  return kind === "gallery" || kind === "photo" || kind === "ai_image";
}
function isPlayableVideo(kind: MediaLibraryKind) {
  return kind === "video" || kind === "slideshow_video" || kind === "video_edit";
}

async function downloadOne(item: MediaLibraryItem) {
  try {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const blob = await res.blob();
    const ext = item.url.split(".").pop()?.split(/[?#]/)[0] || "bin";
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${item.kind}-${item.id}.${ext}`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    // Same CORS-header-gap fallback used by features/admin/memories/moderation-list.tsx.
    console.error("Download via blob failed, opening file directly instead:", err);
    window.open(item.url, "_blank", "noopener,noreferrer");
  }
}

export function MediaLibraryGrid({ eventId, items: initialItems }: MediaLibraryGridProps) {
  const [items, setItems] = useState(initialItems);
  const [activeFilter, setActiveFilter] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const filtered = useMemo(() => {
    const kinds = FILTERS[activeFilter]!.kinds;
    return kinds ? items.filter((it) => kinds.includes(it.kind)) : items;
  }, [items, activeFilter]);

  function selectionKey(item: MediaLibraryItem) {
    return `${item.kind}:${item.id}`;
  }

  function toggleSelect(item: MediaLibraryItem) {
    const key = selectionKey(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedItems = filtered.filter((it) => selected.has(selectionKey(it)));

  async function handleDelete(item: MediaLibraryItem) {
    setBusyId(selectionKey(item));
    const result = await deleteMediaLibraryItemAction(item.kind, item.id);
    if (result.success) {
      setItems((prev) => prev.filter((it) => !(it.kind === item.kind && it.id === item.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(selectionKey(item));
        return next;
      });
    } else {
      alert(result.error);
    }
    setBusyId(null);
  }

  async function handleToggleFeatured(item: MediaLibraryItem) {
    if (item.featured === null || !FEATURABLE_KINDS.includes(item.kind)) return;
    setBusyId(selectionKey(item));
    const result = await toggleMediaLibraryFeaturedAction(item.kind as "photo" | "video" | "audio", item.id, !item.featured);
    if (result.success) {
      setItems((prev) =>
        prev.map((it) => (it.kind === item.kind && it.id === item.id ? { ...it, featured: !it.featured } : it)),
      );
    } else {
      alert(result.error);
    }
    setBusyId(null);
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedItems.length} item(s)? Gallery/Memory Wall items go to the Recycle Bin; AI Image/Slideshow/Video Edit items are removed immediately.`)) return;
    setBulkBusy(true);
    for (const item of selectedItems) {
      const result = await deleteMediaLibraryItemAction(item.kind, item.id);
      if (result.success) {
        setItems((prev) => prev.filter((it) => !(it.kind === item.kind && it.id === item.id)));
      }
    }
    clearSelection();
    setBulkBusy(false);
  }

  async function handleBulkFeature(featured: boolean) {
    const targets = selectedItems.filter((it) => FEATURABLE_KINDS.includes(it.kind));
    setBulkBusy(true);
    for (const item of targets) {
      const result = await toggleMediaLibraryFeaturedAction(item.kind as "photo" | "video" | "audio", item.id, featured);
      if (result.success) {
        setItems((prev) =>
          prev.map((it) => (it.kind === item.kind && it.id === item.id ? { ...it, featured } : it)),
        );
      }
    }
    setBulkBusy(false);
  }

  async function handleCreateShareLink() {
    setBulkBusy(true);
    const result = await createShareCollectionAction(
      eventId,
      selectedItems.map((it) => ({ kind: it.kind, id: it.id })),
    );
    if (result.success) {
      setShareLink(`${window.location.origin}/share/${result.data.token}`);
    } else {
      alert(result.error);
    }
    setBulkBusy(false);
  }

  async function handleCopyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch (err) {
      console.error("Copy link failed:", err);
    }
  }

  async function handleBulkDownload() {
    setBulkBusy(true);
    // Sequential on purpose (not Promise.all) — staggering the blob-download
    // anchor clicks avoids browsers treating a burst of simultaneous
    // synthetic downloads as spam and silently blocking some of them.
    for (const item of selectedItems) {
      await downloadOne(item);
      await new Promise((r) => setTimeout(r, 300));
    }
    setBulkBusy(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setActiveFilter(i)}
            className={cn(
              "rounded-full px-3 py-1.5",
              activeFilter === i ? "bg-gold-500 text-navy-950" : "border border-navy-950/15 text-navy-700/70",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-2 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold-500/30 bg-white p-3 text-sm shadow-sm">
          <span className="font-medium text-navy-950">{selected.size} selected</span>
          <button
            disabled={bulkBusy}
            onClick={() => handleBulkFeature(true)}
            className="tap-target flex items-center gap-1 rounded-full border border-navy-950/15 px-3 py-1.5 text-gold-700 hover:border-gold-500/50 disabled:opacity-50"
          >
            <Sparkles size={14} /> Feature
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => handleBulkFeature(false)}
            className="tap-target flex items-center gap-1 rounded-full border border-navy-950/15 px-3 py-1.5 text-navy-700/70 hover:border-gold-500/50 disabled:opacity-50"
          >
            Unfeature
          </button>
          <button
            disabled={bulkBusy}
            onClick={handleBulkDownload}
            className="tap-target flex items-center gap-1 rounded-full border border-navy-950/15 px-3 py-1.5 text-navy-700/70 hover:border-gold-500/50 disabled:opacity-50"
          >
            <Download size={14} /> Download
          </button>
          <button
            disabled={bulkBusy}
            onClick={handleCreateShareLink}
            className="tap-target flex items-center gap-1 rounded-full border border-navy-950/15 px-3 py-1.5 text-navy-700/70 hover:border-gold-500/50 disabled:opacity-50"
          >
            <Share2 size={14} /> Get Share Link
          </button>
          <button
            disabled={bulkBusy}
            onClick={handleBulkDelete}
            className="tap-target flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-red-600 hover:border-red-400 disabled:opacity-50"
          >
            {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
          </button>
          <button onClick={clearSelection} className="ml-auto text-xs text-navy-700/50 hover:text-navy-950">
            Clear selection
          </button>
        </div>
      ) : null}

      {shareLink ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3 text-sm">
          <span className="font-medium text-navy-950">Share link ready:</span>
          <a href={shareLink} target="_blank" rel="noopener noreferrer" className="truncate text-gold-700 underline underline-offset-4">
            {shareLink}
          </a>
          <button
            onClick={handleCopyShareLink}
            className="tap-target flex items-center gap-1 rounded-full border border-navy-950/15 px-3 py-1.5 text-navy-700/70 hover:border-gold-500/50"
          >
            {linkCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {linkCopied ? "Copied!" : "Copy"}
          </button>
          <button onClick={() => setShareLink(null)} className="ml-auto text-navy-700/50 hover:text-navy-950">
            <X size={16} />
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
          Nothing here yet.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const key = selectionKey(item);
            const isSelected = selected.has(key);
            const busy = busyId === key;
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm",
                  isSelected ? "border-gold-500 ring-2 ring-gold-500/30" : "border-navy-950/10",
                )}
              >
                <div className="relative">
                  <button
                    onClick={() => toggleSelect(item)}
                    title={isSelected ? "Deselect" : "Select"}
                    className="tap-target absolute left-2 top-2 z-[1] flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-navy-950 shadow-sm"
                  >
                    {isSelected ? <SquareCheck size={18} className="text-gold-600" /> : <Square size={18} />}
                  </button>
                  {item.featured ? (
                    <span className="absolute right-2 top-2 z-[1] flex h-7 w-7 items-center justify-center rounded-full bg-gold-500 text-navy-950 shadow-sm">
                      <Sparkles size={14} />
                    </span>
                  ) : null}
                  {isPlayableImage(item.kind) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : isPlayableVideo(item.kind) ? (
                    <video src={item.url} controls className="aspect-video w-full bg-navy-950" />
                  ) : (
                    <div className="bg-navy-950 px-4 py-6">
                      <audio src={item.url} controls className="w-full" />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
                  <span className="text-xs uppercase tracking-wide text-navy-700/40">{MEDIA_LIBRARY_KIND_LABEL[item.kind]}</span>
                  {item.caption ? <p className="line-clamp-2 text-navy-700/80">{item.caption}</p> : null}
                  {item.guestName ? <p className="mt-auto text-xs text-navy-700/50">From {item.guestName}</p> : null}
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-navy-950/5 px-3 py-2">
                  <div className="flex gap-1">
                    {item.featured !== null ? (
                      <button
                        disabled={busy}
                        onClick={() => handleToggleFeatured(item)}
                        title={item.featured ? "Unfeature" : "Feature"}
                        className={cn(
                          "tap-target flex items-center justify-center",
                          item.featured ? "text-gold-500" : "text-navy-700/50 hover:text-gold-500",
                        )}
                      >
                        {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                      </button>
                    ) : null}
                    <button
                      onClick={() => downloadOne(item)}
                      title="Download"
                      className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(item)}
                    title="Delete"
                    className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
                  >
                    {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
