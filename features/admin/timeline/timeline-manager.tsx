"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TimelineMilestoneRecord } from "@/types/content";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/features/admin/timeline/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface TimelineManagerProps {
  eventId: string;
  initialMilestones: TimelineMilestoneRecord[];
}

const EMPTY = { period: "", title: "", description: "" };

export function TimelineManager({ eventId, initialMilestones }: TimelineManagerProps) {
  const [milestones, setMilestones] = useState(
    [...initialMilestones].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd() {
    if (!form.period.trim() || !form.title.trim() || !form.description.trim()) return;
    setBusy(true);
    const result = await createMilestoneAction({
      eventId,
      ...form,
      sortOrder: milestones.length,
    });
    setBusy(false);
    if (result.success) {
      setForm(EMPTY);
      window.location.reload();
    } else {
      alert(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this milestone?")) return;
    setBusyId(id);
    const result = await deleteMilestoneAction(id);
    setBusyId(null);
    if (result.success) {
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } else {
      alert(result.error);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= milestones.length) return;

    const reordered = [...milestones];
    const a = reordered[index];
    const b = reordered[target];
    if (!a || !b) return;
    reordered[index] = b;
    reordered[target] = a;
    setMilestones(reordered);

    setBusy(true);
    await Promise.all(
      reordered.map((m, i) => updateMilestoneAction(m.id, { sortOrder: i })),
    );
    setBusy(false);
  }

  return (
    <div>
      <div className="grid gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:grid-cols-3">
        <input
          placeholder="Period (e.g. Early Years)"
          value={form.period}
          onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
          className={inputClasses}
        />
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={inputClasses}
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputClasses}
        />
        <div className="sm:col-span-3">
          <Button onClick={handleAdd} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
            Add Milestone
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {milestones.map((m, index) => (
          <div
            key={m.id}
            className="flex items-start gap-3 rounded-xl border border-navy-950/10 bg-white p-4"
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={index === 0 || busy}
                onClick={() => move(index, -1)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                disabled={index === milestones.length - 1 || busy}
                onClick={() => move(index, 1)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-gold-600">{m.period}</p>
              <p className="font-display text-lg text-navy-950">{m.title}</p>
              <p className="text-sm text-navy-700/70">{m.description}</p>
            </div>
            <button
              type="button"
              disabled={busyId === m.id}
              onClick={() => handleDelete(m.id)}
              className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {milestones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
            No milestones yet — add the first one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
