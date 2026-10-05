"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import {
  Check,
  Crown,
  Eye,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { TemplatePreviewDialog } from "@/features/admin/templates/template-preview-dialog";
import { ThemeColorCustomizer } from "@/features/templates/theme-color-customizer";

import { updateEventAction } from "@/features/admin/event-settings/actions";
import type { AdminActionResult } from "@/features/admin/event-settings/actions";
import type { TemplateSummary } from "@/lib/template-catalog";
import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";
import { CUSTOM_TEMPLATE_REQUEST } from "@/lib/constants";
import { TEMPLATE_THEMES } from "@/lib/template-themes";
import type { EventCategory, ThemeOverrides } from "@/types/event";

const PREVIEW_SEEN_KEY = "em:template-preview-seen";

export type PickerTemplate = TemplateSummary & {
  designer?: { name: string; website: string | null };
};

/** The one action this component needs — swappable so the wizard can pass its draft-token-gated mirror instead. Defaults to the real admin action. */
export type UpdateTemplateAction = (
  eventId: string,
  input: { templateSlug?: string; themeOverrides?: ThemeOverrides | null },
) => Promise<AdminActionResult>;

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
  /** The event's slug — enables each card's "Preview" popup (the event's own page in that template). */
  eventSlug?: string;
  /** The event's saved colour tweaks (events.theme_overrides) — enables the "Customise colours" panel. */
  currentThemeOverrides?: ThemeOverrides | null;
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
  eventSlug,
  currentThemeOverrides = null,
}: TemplatePickerProps) {
  const [themeOverrides, setThemeOverrides] = useState<ThemeOverrides | null>(currentThemeOverrides);
  const [previewing, setPreviewing] = useState<PickerTemplate | null>(null);
  const [selected, setSelected] = useState(currentTemplateSlug);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Nudges (the pulsing banner button) stop once the host has opened any preview.
  const [hasPreviewed, setHasPreviewed] = useState(true);

  useEffect(() => {
    try {
      setHasPreviewed(localStorage.getItem(PREVIEW_SEEN_KEY) === "1");
    } catch {
      setHasPreviewed(false);
    }
  }, []);

  function openPreview(template: PickerTemplate) {
    setPreviewing(template);
    setHasPreviewed(true);
    try {
      localStorage.setItem(PREVIEW_SEEN_KEY, "1");
    } catch {
      // Private mode etc. — the nudge just keeps showing.
    }
  }

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
            <div
              key={template.slug}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-luxury duration-300 ${
                isSelected
                  ? "border-gold-500 shadow-md"
                  : "border-navy-950/10 hover:border-gold-500/50 hover:shadow-md"
              }`}
            >
              {/* The picture opens the live preview (when there's an event to preview) — the main thing a host should do before choosing. */}
              <button
                type="button"
                onClick={() =>
                  eventSlug
                    ? openPreview(template)
                    : selectTemplate(template.slug)
                }
                aria-label={
                  eventSlug
                    ? `Preview your page in ${template.name}`
                    : `Use ${template.name}`
                }
                className="relative block aspect-[4/3] w-full overflow-hidden bg-navy-950/5"
              >
                <Image
                  src={template.thumbnail}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-navy-950">
                    {pending ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Check size={11} />
                    )}{" "}
                    Your template
                  </span>
                ) : null}
                {eventSlug ? (
                  <>
                    {/* Desktop: a full overlay on hover. Touch screens: a permanent label, since there's no hover. */}
                    <span className="absolute inset-0 hidden items-center justify-center bg-navy-950/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
                      <span className="flex items-center gap-2 whitespace-nowrap rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 shadow-lg">
                        <Eye size={16} /> Preview your page
                      </span>
                    </span>
                    <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-navy-950 shadow-md sm:group-hover:opacity-0">
                      <Eye size={13} className="text-gold-600" /> Live preview
                    </span>
                  </>
                ) : null}
              </button>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base text-navy-950">
                    {template.name}
                  </h3>
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
                <div className="mt-auto flex flex-col gap-2 pt-4">
                  {eventSlug ? (
                    <button
                      type="button"
                      onClick={() => openPreview(template)}
                      className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-gold-500 px-3 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:bg-gold-400"
                    >
                      <Eye size={14} /> Preview your page
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => selectTemplate(template.slug)}
                    disabled={isSelected || pending}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-luxury duration-200 ${
                      isSelected
                        ? "border-gold-500/40 bg-gold-500/10 text-gold-600"
                        : "border-navy-950/15 text-navy-950 hover:border-navy-950/40 disabled:opacity-60"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check size={14} /> Selected
                      </>
                    ) : (
                      "Use this template"
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const recommended = occasion
    ? templates.filter((t) => t.occasions?.includes(occasion))
    : [];
  const rest =
    recommended.length > 0
      ? templates.filter((t) => !recommended.includes(t))
      : templates;

  return (
    <div>
      {eventSlug ? (
        <div className="mb-8 flex flex-col gap-4 overflow-hidden rounded-2xl bg-navy-950 p-5 text-ivory-50 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className="hidden shrink-0 items-end gap-1 text-gold-300 sm:flex"
              aria-hidden="true"
            >
              <Monitor size={34} strokeWidth={1.5} />
              <Smartphone size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-gold-300">
                <Sparkles size={12} /> See it before you choose
              </p>
              <p className="mt-1.5 font-display text-lg sm:text-xl">
                Preview your own event page in any template
              </p>
              <p className="mt-1 text-sm text-ivory-100/70">
                Your name, date, photos and sections — exactly as guests will
                see them, on a phone and on a computer.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const current =
                templates.find((t) => t.slug === selected) ?? templates[0];
              if (current) openPreview(current);
            }}
            className={`relative flex shrink-0 items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-3 text-sm font-medium text-navy-950 shadow-lg transition-luxury duration-200 hover:bg-gold-400 ${
              hasPreviewed ? "" : "ring-4 ring-gold-500/30"
            }`}
          >
            {!hasPreviewed ? (
              <span
                className="absolute -right-1 -top-1 flex h-3 w-3"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-300 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-gold-300" />
              </span>
            ) : null}
            <Eye size={16} /> Preview my page
          </button>
        </div>
      ) : null}

      {TEMPLATE_THEMES[selected] ? (
        <ThemeColorCustomizer
          key={selected}
          templateName={templates.find((t) => t.slug === selected)?.name ?? "this template"}
          theme={TEMPLATE_THEMES[selected]}
          initialOverrides={themeOverrides}
          onSave={async (next) => {
            const result = await updateAction(eventId, { themeOverrides: next });
            if (result.success) setThemeOverrides(next);
            return result;
          }}
        />
      ) : null}

      {recommended.length > 0 ? (
        <>
          <h3 className="mb-3 font-display text-sm text-navy-950">
            Recommended for your {EVENT_CATEGORY_LABELS[occasion!]}
          </h3>
          {renderGrid(recommended)}
          <h3 className="mb-3 mt-8 font-display text-sm text-navy-950">
            More Templates
          </h3>
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

      <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-navy-700/80">
          Not satisfied with the templates available? We can design a custom one
          just for your event.
        </p>
        <a
          href={CUSTOM_TEMPLATE_REQUEST.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-navy-950 px-4 py-2 text-xs font-medium text-ivory-100 transition-colors hover:bg-navy-900"
        >
          Request a Custom Design
        </a>
      </div>
      {previewing && eventSlug ? (
        <TemplatePreviewDialog
          eventSlug={eventSlug}
          template={previewing}
          isSelected={previewing.slug === selected}
          pending={pending}
          onUse={() => selectTemplate(previewing.slug)}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}
