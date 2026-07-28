"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Check, Crown, Loader2 } from "lucide-react";

import { updateEventAction } from "@/features/admin/event-settings/actions";
import type { AdminActionResult } from "@/features/admin/event-settings/actions";
import type { TemplateSummary } from "@/lib/template-catalog";
import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";
import type { EventCategory } from "@/types/event";

export type PickerTemplate = TemplateSummary & {
  designer?: { name: string; website: string | null };
};

/** The one action this component needs — swappable so the wizard can pass its draft-token-gated mirror instead. Defaults to the real admin action. */
export type UpdateTemplateAction = (eventId: string, input: { templateSlug: string }) => Promise<AdminActionResult>;

interface TemplatePickerProps {
  eventId: string;
  currentTemplateSlug: string;
  templates: PickerTemplate[];
  updateAction?: UpdateTemplateAction;
  /**
   * The event's occasion (events.category) — when set, any template
   * whose `occasions` list includes it is pulled into a "Recommended"
   * group shown first. Purely a sort/label hint (see TemplateSummary.
   * occasions); every template still works for any occasion. Optional so
   * the admin Templates page (which doesn't know the occasion up front
   * in the same way) can keep passing nothing and get the flat grid.
   */
  occasion?: EventCategory | null;
}

/**
 * Renders whichever templates the caller passes in — built-in
 * (TEMPLATE_CATALOG) merged with any approved community submissions, see
 * app/admin/(dashboard)/templates/page.tsx. Takes the list as a prop
 * rather than importing TEMPLATE_CATALOG directly so the server-fetched
 * community templates can be merged in without this client component
 * needing to know how that merge happens.
 */
export function TemplatePicker({
  eventId,
  currentTemplateSlug,
  templates,
  updateAction = updateEventAction,
  occasion,
}: TemplatePickerProps) {
  const [selected, setSelected] = useState(currentTemplateSlug);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function selectTemplate(slug: string) {
    if (slug === selected || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateAction(eventId, { templateSlug: slug });
      if (result.success) {
        setSelected(slug);
      } else {
        setError(result.error);
      }
    });
  }

  function renderGrid(list: PickerTemplate[]) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((template) => {
          const isSelected = template.slug === selected;
          return (
            <button
              key={template.slug}
              type="button"
              disabled={pending}
              onClick={() => selectTemplate(template.slug)}
              className={`group relative overflow-hidden rounded-2xl border-2 bg-white text-left transition-luxury duration-300 disabled:cursor-wait ${
                isSelected
                  ? "border-gold-500 shadow-md"
                  : "border-navy-950/10 hover:border-gold-500/50"
              }`}
            >
              <div className="relative aspect-[4/3] w-full bg-navy-950/5">
                <Image
                  src={template.thumbnail}
                  alt={template.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {template.premium ? (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-navy-950/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-gold-300">
                    <Crown size={11} /> ₹{template.price}
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 rounded-full bg-navy-950/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-ivory-100">
                    Free
                  </span>
                )}
                {isSelected ? (
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-white">
                    {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base text-navy-950">{template.name}</h3>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-navy-700/50">
                    {template.category}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-navy-700/70">
                  {template.description}
                </p>
                {template.designer ? (
                  <p className="mt-1.5 text-[11px] text-gold-600">
                    Designed by {template.designer.name}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const recommended = occasion
    ? templates.filter((t) => t.occasions?.includes(occasion))
    : [];
  const rest = recommended.length > 0 ? templates.filter((t) => !recommended.includes(t)) : templates;

  return (
    <div>
      {recommended.length > 0 ? (
        <>
          <h3 className="mb-3 font-display text-sm text-navy-950">
            Recommended for your {EVENT_CATEGORY_LABELS[occasion!]}
          </h3>
          {renderGrid(recommended)}
          <h3 className="mb-3 mt-8 font-display text-sm text-navy-950">More Templates</h3>
          {renderGrid(rest)}
        </>
      ) : (
        renderGrid(rest)
      )}

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-xs text-navy-700/50">
        Premium templates are shown with their price, but checkout isn&rsquo;t
        wired up yet — selecting one applies it immediately at no charge for
        now. Payment collection is on the roadmap (see /platform).
      </p>
    </div>
  );
}
