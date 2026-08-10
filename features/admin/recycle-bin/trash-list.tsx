"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";

import type { TrashItem } from "@/services/recycle-bin";
import { purgeTrashItemAction, restoreTrashItemAction } from "@/features/admin/recycle-bin/actions";

interface TrashListProps {
  items: TrashItem[];
}

function daysLeft(purgeAt: string): number {
  const ms = new Date(purgeAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function TrashList({ items: initialItems }: TrashListProps) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRestore(item: TrashItem) {
    setBusyId(item.id);
    const result = await restoreTrashItemAction(item.kind, item.id);
    if (result.success) {
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } else {
      alert(result.error);
    }
    setBusyId(null);
  }

  async function handlePurge(item: TrashItem) {
    if (!confirm("Permanently delete this? This can't be undone.")) return;
    setBusyId(item.id);
    const result = await purgeTrashItemAction(item.kind, item.id);
    if (result.success) {
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } else {
      alert(result.error);
    }
    setBusyId(null);
  }

  if (items.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
        The Recycle Bin is empty.
      </p>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const left = daysLeft(item.purgeAt);
        const busy = busyId === item.id;
        return (
          <div
            key={`${item.kind}-${item.id}`}
            className="flex flex-col overflow-hidden rounded-xl border border-navy-950/10 bg-white shadow-sm"
          >
            {(item.kind === "gallery" || item.kind === "photo") && item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover opacity-80" />
            ) : null}
            {item.kind === "video" && item.url ? (
              <video src={item.url} controls className="aspect-video w-full bg-navy-950 opacity-80" />
            ) : null}
            {item.kind === "audio" && item.url ? (
              <div className="bg-navy-950 px-4 py-4">
                <audio src={item.url} controls className="w-full" />
              </div>
            ) : null}

            <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
              <span className="text-xs uppercase tracking-wide text-navy-700/40">{item.kindLabel}</span>
              {item.caption ? <p className="text-navy-700/80">{item.caption}</p> : null}
              {item.guestName ? <p className="text-xs text-navy-700/50">From {item.guestName}</p> : null}
              <p className="mt-auto text-xs font-medium text-amber-700">
                {left > 0 ? `Purges in ${left} day${left === 1 ? "" : "s"}` : "Purging soon"}
              </p>
            </div>

            <div className="flex items-center justify-between gap-1 border-t border-navy-950/5 px-3 py-2">
              <button
                disabled={busy}
                onClick={() => handleRestore(item)}
                title="Restore"
                className="tap-target flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Restore
              </button>
              <button
                disabled={busy}
                onClick={() => handlePurge(item)}
                title="Delete Forever"
                className="tap-target flex items-center gap-1.5 text-sm text-navy-700/50 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 size={16} /> Delete Forever
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
