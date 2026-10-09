"use client";

import { useState } from "react";
import type { ScheduleItemRecord } from "@/types/content";
import { updateScheduleItemAction } from "@/features/admin/event-day/actions";

type Details = Pick<ScheduleItemRecord, "startLabel" | "endLabel" | "title" | "description" | "dayLabel">;
const fields = [
  ["dayLabel", "Day / date (optional)", "Saturday, 9 January 2027"],
  ["startLabel", "Start time", "2 PM onwards"],
  ["endLabel", "End time (optional)", "6 PM"],
  ["title", "Title", "Check in"],
  ["description", "Description (optional)", "Details for your guests"],
] as const;

export function ScheduleItemEditor({ item, onSaved, onCancel }: {
  item: ScheduleItemRecord; onSaved: (details: Details) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Details>({ dayLabel: item.dayLabel ?? "", startLabel: item.startLabel, endLabel: item.endLabel ?? "", title: item.title, description: item.description ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    const details = { dayLabel: draft.dayLabel?.trim() || null, startLabel: draft.startLabel.trim(), endLabel: draft.endLabel?.trim() || null, title: draft.title.trim(), description: draft.description?.trim() || null };
    try {
      const result = await updateScheduleItemAction(item.id, details);
      if (!result.success) throw new Error(result.error);
      onSaved(details);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} aria-label={`Edit ${item.title}`} className="grid gap-3 border-t border-navy-950/10 bg-gold-500/5 p-4 sm:grid-cols-2">
    {fields.map(([key, label, placeholder]) => <label key={key} className="grid gap-1 text-sm text-navy-950">
      {label}
      <input autoFocus={key === "dayLabel"} required={key === "startLabel" || key === "title"} maxLength={key === "description" ? 2000 : key === "title" ? 200 : 120} disabled={busy} value={draft[key] ?? ""} placeholder={placeholder} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2" />
    </label>)}
    {error ? <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
    <div className="flex gap-3 sm:col-span-2">
      <button disabled={busy} type="submit" className="rounded-lg bg-gold-500 px-4 py-2 text-sm text-navy-950 disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
      <button disabled={busy} type="button" onClick={onCancel} className="rounded-lg border border-navy-950/20 px-4 py-2 text-sm">Cancel</button>
    </div>
  </form>;
}
