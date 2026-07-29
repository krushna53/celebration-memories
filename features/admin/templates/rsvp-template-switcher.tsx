"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updateEventAction } from "@/features/admin/event-settings/actions";
import type { TemplateSummary } from "@/lib/template-catalog";

interface RsvpTemplateSwitcherProps {
  eventId: string;
  currentTemplateSlug: string;
  templates: TemplateSummary[];
}

/**
 * A compact, admin-only template switcher shown at the very top of the
 * public RSVP page (app/events/[slug]/rsvp/page.tsx) — the page itself
 * decides whether to render this at all (see isAdminForEvent in
 * lib/admin-event.ts), so a real guest never sees it. Deliberately a
 * plain <select> rather than the full thumbnail grid in
 * features/admin/templates/template-picker.tsx — this is a quick swap
 * for someone already looking at the live page, not a browsing
 * experience, and a big image grid would push the actual RSVP form
 * below the fold on mobile.
 */
export function RsvpTemplateSwitcher({ eventId, currentTemplateSlug, templates }: RsvpTemplateSwitcherProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentTemplateSlug);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(slug: string) {
    const previous = selected;
    setSelected(slug);
    setError(null);
    startTransition(async () => {
      const result = await updateEventAction(eventId, { templateSlug: slug });
      if (result.success) {
        router.refresh();
      } else {
        setSelected(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="border-b border-gold-500/20 bg-navy-950 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 text-xs">
        <span className="uppercase tracking-[0.2em] text-gold-400">
          Admin view only &mdash; visitors never see this bar
        </span>
        <label className="flex items-center gap-2 text-ivory-100/80">
          Template
          <select
            value={selected}
            disabled={pending}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-md border border-white/20 bg-navy-900 px-2 py-1 text-xs text-ivory-100 disabled:opacity-60"
          >
            {templates.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
          {pending ? <Loader2 className="animate-spin" size={13} /> : null}
        </label>
      </div>
      {error ? <p className="mx-auto mt-1 max-w-2xl text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
