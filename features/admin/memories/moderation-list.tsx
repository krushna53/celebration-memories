"use client";

import { useState } from "react";
import { Check, Download, Loader2, Sparkles, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ModerationItem } from "@/services/admin-memories";
import {
  approveMemoryAction,
  deleteMemoryAction,
  rejectMemoryAction,
  toggleFeaturedAction,
} from "@/features/admin/memories/actions";

interface ModerationListProps {
  items: ModerationItem[];
}

export function ModerationList({ items: initialItems }: ModerationListProps) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<void>, removeAfter = false) {
    setBusyId(id);
    await fn();
    if (removeAfter) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    } else {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it } : it)),
      );
    }
    setBusyId(null);
  }

  // Supabase Storage URLs are cross-origin, so a plain <a href download>
  // just opens the file inline in most browsers instead of saving it —
  // same fetch-as-blob-then-synthetic-click technique used by the guest-
  // facing share/download buttons in components/media/media-share-buttons.tsx.
  async function handleDownload(item: ModerationItem) {
    if (!item.url) return;
    setDownloadingId(item.id);
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const ext = item.url.split(".").pop()?.split(/[?#]/)[0] || "bin";
      const safeGuestName = item.guestName.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "guest";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${item.kind}-${safeGuestName}.${ext}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      // fetch() to read the response body requires CORS headers, even
      // though the exact same URL loads fine in the <video>/<img> tag
      // above (media/image elements don't need CORS just to display).
      // A network hiccup or a CORS-header gap on the Storage response
      // can make the fetch fail while the file is still perfectly
      // reachable — rather than a silent dead end, fall back to opening
      // it directly so the admin can still save it (right-click/long-
      // press "Save As", or the browser's built-in download button).
      console.error("Download via blob failed, opening file directly instead:", err);
      window.open(item.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
        Nothing to review right now.
      </p>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={`${item.kind}-${item.id}`}
          className={cn(
            "flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm",
            item.approved ? "border-green-200" : "border-amber-200",
          )}
        >
          {item.kind === "photo" && item.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
          ) : null}
          {item.kind === "video" && item.url ? (
            <video src={item.url} controls className="aspect-video w-full bg-navy-950" />
          ) : null}
          {item.kind === "audio" && item.url ? (
            <div className="bg-navy-950 px-4 py-4">
              <audio src={item.url} controls className="w-full" />
            </div>
          ) : null}

          <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-navy-700/40">{item.kind}</span>
            {item.message ? <p className="italic text-navy-950">&ldquo;{item.message}&rdquo;</p> : null}
            {item.caption ? <p className="text-navy-700/80">{item.caption}</p> : null}
            <p className="mt-auto text-xs text-navy-700/50">{item.guestName}</p>
          </div>

          <div className="flex items-center justify-between gap-1 border-t border-navy-950/5 px-3 py-2">
            <div className="flex gap-1">
              {!item.approved ? (
                <button
                  disabled={busyId === item.id}
                  onClick={() => run(item.id, () => approveMemoryAction(item.kind, item.id))}
                  title="Approve"
                  className="tap-target flex items-center justify-center text-green-600 hover:text-green-700"
                >
                  <Check size={18} />
                </button>
              ) : (
                <button
                  disabled={busyId === item.id}
                  onClick={() => run(item.id, () => rejectMemoryAction(item.kind, item.id))}
                  title="Unapprove"
                  className="tap-target flex items-center justify-center text-navy-700/50 hover:text-amber-600"
                >
                  <X size={18} />
                </button>
              )}
              <button
                disabled={busyId === item.id}
                onClick={() =>
                  run(item.id, () => toggleFeaturedAction(item.kind, item.id, !item.featured))
                }
                title={item.featured ? "Unfeature" : "Feature"}
                className={cn(
                  "tap-target flex items-center justify-center",
                  item.featured ? "text-gold-500" : "text-navy-700/50 hover:text-gold-500",
                )}
              >
                <Sparkles size={18} />
              </button>
              {item.url ? (
                <button
                  disabled={downloadingId === item.id}
                  onClick={() => handleDownload(item)}
                  title="Download"
                  className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600"
                >
                  {downloadingId === item.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                </button>
              ) : null}
            </div>
            <button
              disabled={busyId === item.id}
              onClick={() =>
                run(item.id, () => deleteMemoryAction(item.kind, item.id), true)
              }
              title="Delete"
              className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
