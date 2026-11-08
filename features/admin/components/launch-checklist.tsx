"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Circle } from "lucide-react";
import { buildLaunchChecks, type LaunchEvent } from "@/lib/launch-checklist";

export function LaunchChecklist({ event, draftToken }: { event: LaunchEvent; draftToken?: string }) {
  const [reviewed, setReviewed] = useState<string[]>([]);
  // A changed date, access setting, or template requires a fresh review.
  const revision = JSON.stringify(event);
  const storageKey = `everymoment-launch-${event.id}`;
  useEffect(() => {
    setReviewed([]);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (stored?.revision === revision && Array.isArray(stored.reviewed)) {
        setReviewed(stored.reviewed.filter((value: unknown) => typeof value === "string"));
      }
    } catch { /* Reviewing still works when browser storage is unavailable. */ }
  }, [storageKey, revision]);

  function toggle(id: string) {
    const next = reviewed.includes(id) ? reviewed.filter((value) => value !== id) : [...reviewed, id];
    setReviewed(next);
    try { localStorage.setItem(storageKey, JSON.stringify({ revision, reviewed: next })); } catch { /* Optional persistence. */ }
  }

  const checks = buildLaunchChecks(event, draftToken);
  const completed = checks.filter((check) => check.automatic ? check.complete : reviewed.includes(check.id)).length;
  return (
    <section aria-labelledby="launch-checklist-title" className="rounded-xl border border-gold-500/30 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="launch-checklist-title" className="font-display text-lg text-navy-950">Before you share</h2>
        <span className="text-xs text-navy-700/60" role="status">{completed} of {checks.length} checked</span>
      </div>
      <p className="mt-1 text-sm text-navy-700/60">Check the essentials, then open your page as a guest. Your review ticks are saved on this device.</p>
      <progress aria-label="Launch checklist completion" value={completed} max={checks.length} className="mt-4 h-2 w-full accent-gold-500" />
      <ul className="mt-3 divide-y divide-navy-950/10">
        {checks.map((check) => {
          const done = check.automatic ? check.complete : reviewed.includes(check.id);
          return (
            <li key={check.id} className="flex items-start gap-3 py-3">
              {check.automatic ? (
                done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green-700" aria-label="Complete" /> : <Circle size={20} className="mt-0.5 shrink-0 text-navy-700/40" aria-label="Needs attention" />
              ) : (
                <input id={`launch-${check.id}`} type="checkbox" checked={done} onChange={() => toggle(check.id)} className="mt-1 h-5 w-5 shrink-0 accent-gold-500" />
              )}
              <div className="min-w-0 flex-1">
                {check.automatic ? <p className="text-sm font-medium text-navy-950">{check.label}</p> : <label htmlFor={`launch-${check.id}`} className="cursor-pointer text-sm font-medium text-navy-950">{check.label}</label>}
                <p className="mt-0.5 text-xs leading-relaxed text-navy-700/65">{check.detail}</p>
              </div>
              <Link href={check.href} target={check.id === "preview" ? "_blank" : undefined} rel={check.id === "preview" ? "noopener noreferrer" : undefined} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-xs font-medium text-gold-700 underline underline-offset-4">
                {check.action} <ArrowUpRight size={13} />
              </Link>
            </li>
          );
        })}
      </ul>
      {completed === checks.length ? <p className="mt-3 text-sm text-green-700">Your checklist is complete. {draftToken ? "Continue below to choose a plan and publish." : event.pageStatus === "unpublished" ? "Your page is unpublished. Publish it in Event Settings when you’re ready." : "You’re ready to share your event link."}</p> : null}
    </section>
  );
}
