"use client";

import { useState } from "react";
import { Check, Sparkles, Trash2, X } from "lucide-react";

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
