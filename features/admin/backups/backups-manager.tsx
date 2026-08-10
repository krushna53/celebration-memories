"use client";

import { useState, useTransition } from "react";
import { Clock, History, Image as ImageIcon, Loader2, RotateCcw, Settings, Users } from "lucide-react";

import { restoreSnapshotAction } from "@/features/admin/backups/actions";
import type { EventSnapshotRecord, SnapshotArea } from "@/services/event-snapshots";

interface BackupsManagerProps {
  snapshotsByArea: Record<SnapshotArea, EventSnapshotRecord[]>;
  creatorNames: Record<string, string>;
}

const AREA_COPY: Record<SnapshotArea, { label: string; icon: typeof Settings; caveat: string }> = {
  event_settings: {
    label: "Event Settings & Template",
    icon: Settings,
    caveat: "Restores honoree/host details, venue, description, template, custom CSS, and section order.",
  },
  gallery: {
    label: "Gallery",
    icon: ImageIcon,
    caveat: "A full revert to that point in time — photos added after this backup will be removed (including their files).",
  },
  timeline: {
    label: "Timeline",
    icon: Clock,
    caveat: "A full revert to that point in time — milestones added after this backup will be removed (including their images).",
  },
  invitees: {
    label: "Invitees",
    icon: Users,
    caveat: "Undoes edits/deletions to guests who existed at this point — never removes guests added since, so an already-sent invite link never breaks.",
  },
};

const AREA_ORDER: SnapshotArea[] = ["event_settings", "gallery", "timeline", "invitees"];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Per-event backup/restore (task #70) — tabs per content area, each a
 * flat newest-first list of point-in-time snapshots with a Restore
 * button. Every mutating Server Action in Event Settings/Gallery/
 * Timeline/Invitees snapshots-before-writing (see services/event-
 * snapshots.ts), so this list is populated automatically, never
 * manually created by the admin.
 */
export function BackupsManager({ snapshotsByArea, creatorNames }: BackupsManagerProps) {
  const [activeArea, setActiveArea] = useState<SnapshotArea>("event_settings");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  const items = snapshotsByArea[activeArea] ?? [];
  const copy = AREA_COPY[activeArea];

  function handleRestore(snapshot: EventSnapshotRecord) {
    if (!confirm(`Restore ${AREA_COPY[snapshot.area].label} to this version (${formatWhen(snapshot.createdAt)})? ${AREA_COPY[snapshot.area].caveat}`)) {
      return;
    }
    setMessage(null);
    setRestoringId(snapshot.id);
    startTransition(async () => {
      const result = await restoreSnapshotAction(snapshot.id);
      setRestoringId(null);
      if (!result.success) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      if (result.area === "invitees") {
        setMessage({
          tone: "success",
          text: `Restored — ${result.detail.updated} updated, ${result.detail.recreated} brought back${
            result.detail.untouchedAdditions > 0 ? `, ${result.detail.untouchedAdditions} added since left untouched` : ""
          }.`,
        });
      } else {
        setMessage({ tone: "success", text: "Restored — a snapshot of what was there before was saved automatically." });
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {AREA_ORDER.map((area) => {
          const Icon = AREA_COPY[area].icon;
          return (
            <button
              key={area}
              type="button"
              onClick={() => {
                setActiveArea(area);
                setMessage(null);
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-luxury duration-200 ${
                activeArea === area ? "border-gold-500 bg-gold-500/10 text-navy-950" : "border-navy-950/10 text-navy-700/70 hover:border-gold-500/40"
              }`}
            >
              <Icon size={14} />
              {AREA_COPY[area].label}
              <span className="text-xs text-navy-700/40">({snapshotsByArea[area]?.length ?? 0})</span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-navy-700/50">{copy.caveat}</p>

      {message ? (
        <p className={`mt-3 text-sm ${message.tone === "success" ? "text-emerald-700" : "text-red-600"}`} role="alert">
          {message.text}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-950/15 py-10 text-center text-sm text-navy-700/50">
            <History className="mx-auto mb-2 text-navy-700/30" size={20} />
            No backups yet for {copy.label.toLowerCase()} — one is saved automatically every time something changes here.
          </p>
        ) : (
          items.map((snapshot) => (
            <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-950/10 bg-white p-4">
              <div>
                <p className="text-sm font-medium text-navy-950">
                  {formatWhen(snapshot.createdAt)}
                  {snapshot.label ? <span className="ml-2 rounded-full bg-navy-950/5 px-2 py-0.5 text-xs text-navy-700/60">{snapshot.label}</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-navy-700/50">
                  {snapshot.createdBy ? (creatorNames[snapshot.createdBy] ?? "Unknown") : "System"}
                </p>
              </div>
              <button
                type="button"
                disabled={restoringId === snapshot.id}
                onClick={() => handleRestore(snapshot)}
                className="tap-target flex items-center gap-1.5 rounded-full border border-gold-500/40 px-3.5 py-1.5 text-xs font-medium text-gold-700 hover:border-gold-500 hover:bg-gold-500/5 disabled:opacity-50"
              >
                {restoringId === snapshot.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                Restore
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
