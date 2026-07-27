"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";

import { deleteDraftEventAction } from "@/features/admin/drafts/actions";
import type { DraftSummary } from "@/services/event-drafts";

/**
 * Owner-only list of in-progress wizard drafts (app/admin/(dashboard)/drafts).
 * Manual delete only — per the deliberate decision that drafts never
 * auto-expire (see services/event-drafts.ts's deleteDraftEvent).
 */
export function DraftList({ initialDrafts }: { initialDrafts: DraftSummary[] }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(id: string, label: string) {
    if (!confirm(`Permanently delete "${label}"? This deletes everything added so far — photos, timeline, slideshow. This can't be undone.`)) {
      return;
    }
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteDraftEventAction(id);
      setBusyId(null);
      if (result.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      } else {
        setError(result.error);
      }
    });
  }

  if (drafts.length === 0) {
    return <p className="text-sm text-navy-700/60">No drafts in progress right now.</p>;
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-navy-950/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-950/5">
            {drafts.map((draft) => (
              <tr key={draft.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-navy-950">{draft.honoreeName}</div>
                  <div className="text-xs text-navy-700/50">{draft.eventTitle}</div>
                </td>
                <td className="px-4 py-3 text-navy-700/70">
                  {new Date(draft.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/events/${draft.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-navy-700/60 hover:text-navy-950"
                    >
                      <ExternalLink size={13} /> Preview
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === draft.id}
                      onClick={() => remove(draft.id, draft.honoreeName)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {busyId === draft.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
