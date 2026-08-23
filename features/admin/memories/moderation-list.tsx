"use client";

import { useRef, useState } from "react";
import { Check, Download, GripVertical, Loader2, Pencil, Sparkles, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ModerationItem, ModerationKind } from "@/services/admin-memories";
import {
  approveMemoryAction,
  deleteMemoryAction,
  rejectMemoryAction,
  reorderMemoriesAction,
  toggleFeaturedAction,
  updateMemoryMetaAction,
} from "@/features/admin/memories/actions";

const inputCls =
  "w-full rounded border border-navy-950/15 bg-white px-2 py-1 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30";

function InlineEdit({
  item,
  onSaved,
  onCancel,
}: {
  item: ModerationItem;
  onSaved: (fields: { caption?: string; guestName?: string; message?: string }) => void;
  onCancel: () => void;
}) {
  const [guestName, setGuestName] = useState(item.guestName);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [message, setMessage] = useState(item.message ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const fields: { caption?: string; guestName?: string; message?: string } = {};
      if (item.kind === "guestbook") {
        fields.guestName = guestName.trim();
        fields.message = message.trim();
      } else {
        fields.caption = caption.trim();
      }
      await updateMemoryMetaAction(item.kind, item.id, fields);
      onSaved(fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3 text-sm">
      {item.kind === "guestbook" ? (
        <>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-widest text-navy-700/50">Name</label>
            <input className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-widest text-navy-700/50">Message</label>
            <textarea className={cn(inputCls, "resize-y")} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} />
          </div>
        </>
      ) : (
        <div>
          <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-widest text-navy-700/50">Caption</label>
          <input className={inputCls} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Add a caption…" />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 rounded-md bg-gold-500 px-3 py-1 text-xs font-medium text-navy-950 hover:bg-gold-400 disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
        <button onClick={onCancel} className="rounded-md px-3 py-1 text-xs text-navy-700/60 hover:text-navy-950">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Single memory card — used inside the kind group. */
function MemoryCard({
  item,
  busyId,
  downloadingId,
  editingId,
  dragOverThis,
  onApprove,
  onReject,
  onToggleFeatured,
  onEdit,
  onSaved,
  onCancelEdit,
  onDownload,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  item: ModerationItem;
  busyId: string | null;
  downloadingId: string | null;
  editingId: string | null;
  dragOverThis: boolean;
  onApprove: () => void;
  onReject: () => void;
  onToggleFeatured: () => void;
  onEdit: () => void;
  onSaved: (fields: { caption?: string; guestName?: string; message?: string }) => void;
  onCancelEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-150",
        item.approved ? "border-green-200" : "border-amber-200",
        busyId === item.id && "opacity-50",
        dragOverThis && "border-gold-500 ring-2 ring-gold-400/30 scale-[1.02]",
      )}
    >
      {/* Drag handle — only THIS element is draggable so <video>/<audio>
          inside the card can't intercept the drag event. */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className="flex items-center gap-1.5 border-b border-navy-950/5 px-2 py-1.5 text-navy-700/40 cursor-grab active:cursor-grabbing select-none hover:bg-navy-950/5"
      >
        <GripVertical size={14} />
        <span className="text-[10px] uppercase tracking-widest">Drag to reorder</span>
      </div>

      {item.kind === "photo" && item.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" draggable={false} className="aspect-[4/3] w-full object-cover" />
      ) : null}
      {item.kind === "video" && item.url ? (
        <>
          {/* draggable={false} prevents the video element from stealing the drag */}
          <video src={item.url} controls draggable={false} className="aspect-video w-full bg-navy-950" />
          <div className="border-t-2 border-gold-400 bg-gold-500/10 px-3 py-1.5">
            <p className="truncate text-xs font-medium text-navy-950">
              <span className="text-navy-700/60">From</span> {item.guestName}
            </p>
          </div>
        </>
      ) : null}
      {item.kind === "audio" && item.url ? (
        <div className="bg-navy-950 px-4 py-4">
          <audio src={item.url} controls draggable={false} className="w-full" />
        </div>
      ) : null}

      {editingId === item.id ? (
        <InlineEdit item={item} onSaved={onSaved} onCancel={onCancelEdit} />
      ) : (
        <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
          <span className="text-xs uppercase tracking-wide text-navy-700/40">{item.kind}</span>
          {item.message ? <p className="italic text-navy-950">&ldquo;{item.message}&rdquo;</p> : null}
          {item.caption ? <p className="text-navy-700/80">{item.caption}</p> : null}
          <p className="mt-auto text-xs text-navy-700/50">{item.guestName}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-1 border-t border-navy-950/5 px-3 py-2">
        <div className="flex gap-1">
          {!item.approved ? (
            <button
              disabled={busyId === item.id}
              onClick={onApprove}
              title="Approve"
              className="tap-target flex items-center justify-center text-green-600 hover:text-green-700"
            >
              <Check size={18} />
            </button>
          ) : (
            <button
              disabled={busyId === item.id}
              onClick={onReject}
              title="Unapprove"
              className="tap-target flex items-center justify-center text-navy-700/50 hover:text-amber-600"
            >
              <X size={18} />
            </button>
          )}
          <button
            disabled={busyId === item.id}
            onClick={onToggleFeatured}
            title={item.featured ? "Unfeature" : "Feature"}
            className={cn(
              "tap-target flex items-center justify-center",
              item.featured ? "text-gold-500" : "text-navy-700/50 hover:text-gold-500",
            )}
          >
            <Sparkles size={18} />
          </button>
          <button
            onClick={onEdit}
            title="Edit name / caption"
            className={cn(
              "tap-target flex items-center justify-center",
              editingId === item.id ? "text-gold-500" : "text-navy-700/50 hover:text-gold-500",
            )}
          >
            <Pencil size={16} />
          </button>
          {item.url ? (
            <button
              disabled={downloadingId === item.id}
              onClick={onDownload}
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
          onClick={onDelete}
          title="Delete"
          className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<ModerationKind, string> = {
  photo: "Photos",
  video: "Videos",
  audio: "Voice Messages",
  guestbook: "Guest Book",
};

/**
 * Draggable group of memories for one kind (photos, videos, etc.).
 * Drag the grip handle at the top of each card to reorder.
 * Order is saved per-kind and applied to the Memory Wall + Big Screen display.
 * Requires migration 0059 (sort_order columns) to be applied.
 */
function KindGroup({
  kind,
  initialItems,
  onDelete,
}: {
  kind: ModerationKind;
  initialItems: ModerationItem[];
  onDelete: (id: string) => void;
}) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, idx: number) {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  }
  function handleDragLeave(e: React.DragEvent) {
    // Only clear the highlight when the mouse leaves the card entirely —
    // not when it moves between child elements inside the same card.
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) return;
    setDragOverIdx(null);
  }
  async function handleDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    setDragOverIdx(null);
    const from = dragIdx.current;
    dragIdx.current = null;
    if (from === null || from === dropIdx) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved!);
    setItems(next);

    setReorderSaving(true);
    setReorderError(null);
    const result = await reorderMemoriesAction(kind, next.map((it) => it.id));
    setReorderSaving(false);
    if (!result.success) {
      setReorderError("Order not saved — please try again.");
      setItems(items); // revert
    }
  }
  function handleDragEnd() {
    dragIdx.current = null;
    setDragOverIdx(null);
  }

  async function run(id: string, fn: () => Promise<void>, removeAfter = false) {
    setBusyId(id);
    await fn();
    if (removeAfter) {
      setItems((prev) => prev.filter((it) => it.id !== id));
      onDelete(id);
    }
    setBusyId(null);
  }

  async function handleDownload(item: ModerationItem) {
    if (!item.url) return;
    setDownloadingId(item.id);
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const ext = item.url.split(".").pop()?.split(/[?#]/)[0] ?? "bin";
      const safeGuestName = item.guestName.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "guest";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${item.kind}-${safeGuestName}.${ext}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Download via blob failed, opening file directly instead:", err);
      window.open(item.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-lg text-navy-950">{KIND_LABEL[kind]}</h2>
        {reorderSaving && (
          <span className="flex items-center gap-1 text-xs text-navy-700/50">
            <Loader2 size={11} className="animate-spin" /> Saving order…
          </span>
        )}
        {reorderError && <span className="text-xs text-red-600">{reorderError}</span>}
        {!reorderSaving && !reorderError && items.length > 1 && (
          <span className="text-[10px] text-navy-700/30">Drag ⠿ to reorder</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => (
          <MemoryCard
            key={`${item.kind}-${item.id}`}
            item={item}
            busyId={busyId}
            downloadingId={downloadingId}
            editingId={editingId}
            dragOverThis={dragOverIdx === idx}
            onApprove={() => run(item.id, () => approveMemoryAction(item.kind, item.id))}
            onReject={() => run(item.id, () => rejectMemoryAction(item.kind, item.id))}
            onToggleFeatured={() => run(item.id, () => toggleFeaturedAction(item.kind, item.id, !item.featured))}
            onEdit={() => setEditingId(editingId === item.id ? null : item.id)}
            onSaved={(fields) => {
              setItems((prev) =>
                prev.map((it) =>
                  it.id === item.id
                    ? {
                        ...it,
                        guestName: fields.guestName ?? it.guestName,
                        caption: fields.caption !== undefined ? fields.caption : it.caption,
                        message: fields.message !== undefined ? fields.message : it.message,
                      }
                    : it,
                ),
              );
              setEditingId(null);
            }}
            onCancelEdit={() => setEditingId(null)}
            onDownload={() => handleDownload(item)}
            onDelete={() => run(item.id, () => deleteMemoryAction(item.kind, item.id), true)}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={(e) => handleDragLeave(e)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

interface ModerationListProps {
  items: ModerationItem[];
}

/** Groups items by kind and renders each group with drag-and-drop reordering. */
export function ModerationList({ items: initialItems }: ModerationListProps) {
  const [items, setItems] = useState(initialItems);

  const kinds: ModerationKind[] = ["photo", "video", "audio", "guestbook"];

  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
        Nothing to review right now.
      </p>
    );
  }

  return (
    <div>
      {kinds.map((kind) => {
        const kindItems = items.filter((it) => it.kind === kind);
        if (kindItems.length === 0) return null;
        return (
          <KindGroup
            key={kind}
            kind={kind}
            initialItems={kindItems}
            onDelete={(id) => setItems((prev) => prev.filter((it) => it.id !== id))}
          />
        );
      })}
    </div>
  );
}
