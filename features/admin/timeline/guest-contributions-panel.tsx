"use client";

import { useState } from "react";
import { Check, Copy, Loader2, MessageCircle, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { staleDeployMessage } from "@/lib/stale-deploy";
import {
  approveTimelineSubmissionAction,
  rejectTimelineSubmissionAction,
  setTimelineContributionsAction,
} from "@/features/admin/timeline/contribution-actions";
import type { PendingSubmission } from "@/services/timeline-contributions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const NEW = "new";

interface GuestContributionsPanelProps {
  eventId: string;
  shareUrl: string;
  honoreeName: string;
  enabled: boolean;
  submissions: PendingSubmission[];
  milestones: { id: string; period: string; title: string }[];
}

function defaultMessage(honoreeName: string, url: string) {
  return `We're putting together ${honoreeName}'s life story for the celebration 🎉\n\nDo you have photos from any of these moments — or one we've missed? Old prints are welcome too (just take a photo of them).\n\nAdd them here: ${url}`;
}

/**
 * Admin → Timeline: switch guest contributions on/off, share the link,
 * and review what guests sent (services/timeline-contributions.ts).
 * Nothing a guest sends is public until it's approved here.
 */
export function GuestContributionsPanel({ eventId, shareUrl, honoreeName, enabled, submissions, milestones }: GuestContributionsPanelProps) {
  const [isOn, setIsOn] = useState(enabled);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = defaultMessage(honoreeName, shareUrl);

  async function toggle() {
    setToggling(true);
    const result = await setTimelineContributionsAction(eventId, !isOn).catch((err: unknown) => ({
      success: false as const,
      error: staleDeployMessage(err) ?? "Failed.",
    }));
    setToggling(false);
    if (result.success) setIsOn(!isOn);
    else alert(result.error);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this message:", message);
    }
  }

  return (
    <section aria-labelledby="guest-contributions-heading" className="mb-6 rounded-xl border border-gold-500/20 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="guest-contributions-heading" className="flex items-center gap-2 font-display text-lg text-navy-950">
            <Users size={17} className="text-gold-600" /> Guest contributions
            {submissions.length > 0 ? (
              <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-medium text-navy-950">{submissions.length} to review</span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-navy-700/60">
            Let guests send photos for {honoreeName}&rsquo;s timeline — for one of your milestones, or a memory you don&rsquo;t have yet. You
            approve everything before it appears.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-navy-950">
          <span>{isOn ? "Open" : "Closed"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label="Let guests add photos to the timeline"
            disabled={toggling}
            onClick={() => void toggle()}
            className={`relative h-6 w-11 rounded-full transition-colors ${isOn ? "bg-gold-500" : "bg-navy-950/20"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isOn ? "left-[1.375rem]" : "left-0.5"}`} />
          </button>
        </label>
      </div>

      {isOn ? (
        <div className="mt-3 space-y-2 rounded-lg bg-gold-500/5 p-3">
          <p className="break-all text-xs text-navy-700/80">
            Link: <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-gold-700 underline">{shareUrl}</a>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={13} /> Ask on WhatsApp
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy message"}
            </Button>
          </div>
          <p className="text-xs text-navy-700/50">
            Guests also see an &ldquo;Add to the Timeline&rdquo; card on their personal invitation page while this is open.
          </p>
        </div>
      ) : null}

      {submissions.length > 0 ? (
        <ol className="mt-4 space-y-3">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} milestones={milestones} />
          ))}
        </ol>
      ) : isOn ? (
        <p className="mt-3 text-xs text-navy-700/50">Nothing to review yet.</p>
      ) : null}
    </section>
  );
}

function SubmissionCard({ submission: s, milestones }: { submission: PendingSubmission; milestones: GuestContributionsPanelProps["milestones"] }) {
  const pickedStillExists = s.milestoneId && milestones.some((m) => m.id === s.milestoneId);
  const [target, setTarget] = useState<string>(pickedStillExists ? (s.milestoneId as string) : NEW);
  const [keep, setKeep] = useState<Set<string>>(new Set(s.photos.map((p) => p.id)));
  const [period, setPeriod] = useState(s.proposedPeriod ?? s.photos.find((p) => p.takenAt)?.takenAt?.slice(0, 4) ?? "");
  const [title, setTitle] = useState(s.proposedTitle ?? "");
  const [description, setDescription] = useState(s.story ?? "");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const forWhat = s.milestoneId
    ? `for “${milestones.find((m) => m.id === s.milestoneId)?.title ?? "a milestone that was since removed"}”`
    : `a new memory${s.proposedTitle ? `: “${s.proposedTitle}”` : ""}${s.proposedPeriod ? ` (${s.proposedPeriod})` : ""}`;

  function toggleKeep(id: string) {
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approve() {
    setBusy("approve");
    const result = await approveTimelineSubmissionAction(s.id, {
      milestoneId: target === NEW ? null : target,
      period,
      title,
      description: description || `Shared by ${s.contributorName}.`,
      photoIds: [...keep],
    }).catch((err: unknown) => ({ success: false as const, error: staleDeployMessage(err) ?? "Failed." }));
    if (result.success) window.location.reload();
    else {
      alert(result.error);
      setBusy(null);
    }
  }

  async function reject() {
    if (!confirm(`Reject ${s.contributorName}'s ${s.photos.length} photo${s.photos.length === 1 ? "" : "s"}? They'll be deleted.`)) return;
    setBusy("reject");
    const result = await rejectTimelineSubmissionAction(s.id).catch((err: unknown) => ({
      success: false as const,
      error: staleDeployMessage(err) ?? "Failed.",
    }));
    if (result.success) window.location.reload();
    else {
      alert(result.error);
      setBusy(null);
    }
  }

  return (
    <li className="rounded-lg border border-navy-950/10 p-3">
      <p className="text-sm text-navy-950">
        <strong>{s.contributorName}</strong> <span className="text-navy-700/70">sent {s.photos.length} photo{s.photos.length === 1 ? "" : "s"} {forWhat}</span>
      </p>
      {s.story ? <p className="mt-1 whitespace-pre-line text-sm italic text-navy-700/80">&ldquo;{s.story}&rdquo;</p> : null}

      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Photos — untick any you don't want">
        {s.photos.map((p) => {
          const kept = keep.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggleKeep(p.id)}
                aria-pressed={kept}
                aria-label={`${kept ? "Keeping" : "Not keeping"} ${p.originalName ?? "photo"}${p.takenAt ? `, taken ${p.takenAt.slice(0, 10)}` : ""}`}
                className={`relative block h-20 w-20 overflow-hidden rounded-lg ${kept ? "ring-2 ring-gold-500" : "opacity-40"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full ${kept ? "bg-gold-500 text-navy-950" : "bg-white/80 text-navy-700"}`}>
                  {kept ? <Check size={12} /> : <X size={12} />}
                </span>
                {p.takenAt ? (
                  <span className="absolute inset-x-0 bottom-0 bg-navy-950/60 py-0.5 text-center text-[10px] text-ivory-50">{p.takenAt.slice(0, 4)}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 space-y-2">
        <select className={inputClasses} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Add the photos to">
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              Add to “{m.title}” ({m.period})
            </option>
          ))}
          <option value={NEW}>Create a new milestone</option>
        </select>
        {target === NEW ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <input className={inputClasses} value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Period" aria-label="Period" />
              <input className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
            </div>
            <textarea
              className={inputClasses}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Description (defaults to “Shared by ${s.contributorName}.”)`}
              aria-label="Description"
            />
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" disabled={busy !== null} onClick={() => void reject()}>
            {busy === "reject" ? <Loader2 className="animate-spin" size={13} /> : <X size={13} />} Reject
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy !== null || keep.size === 0 || (target === NEW && (!period.trim() || !title.trim()))}
            onClick={() => void approve()}
          >
            {busy === "approve" ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />}
            Approve {keep.size} photo{keep.size === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </li>
  );
}
