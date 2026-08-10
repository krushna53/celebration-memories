"use client";

import { Fragment, type ReactNode } from "react";
import { CalendarDays, Car, CheckCircle2, Clock, Images, MapPin, Radio, Shirt } from "lucide-react";

import { getWishSectionCopy } from "@/lib/event-category";
import { normalizeSectionConfig, type SectionConfigItem, type SectionKey } from "@/lib/section-registry";
import type { EventRecord } from "@/types/event";

export interface EventSettingsPreviewData {
  honoreeName: string;
  hostedBy: string;
  eventTitle: string;
  occasion: string;
  startAt: string;
  venueName: string;
  parkingInfo: string;
  dressCode: string;
  wishMessage: string;
  category: EventRecord["category"];
  sectionConfig: SectionConfigItem[] | null;
}

/**
 * `form.startAt` is already a zoned wall-clock string (see
 * utcIsoToZonedInputValue in lib/timezone.ts) — the numbers already
 * represent the correct local time at the venue, so this just formats
 * those numbers for display. No UTC/timezone conversion needed (or
 * wanted — converting again would double-apply the offset), unlike
 * every guest-facing date/time which threads through the event's
 * timezone via formatEventDate/formatEventTime.
 */
function formatPreviewDate(value: string): string {
  if (!value) return "";
  const [datePart, timePart] = value.split("T");
  if (!datePart) return "";
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (!timePart) return dateLabel;
  const [hh, mm] = timePart.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return dateLabel;
  const timeLabel = new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel} • ${timeLabel}`;
}

const previewLabel = "text-[10px] font-medium uppercase tracking-[0.2em] text-gold-600";

function PreviewSectionShell({
  tone,
  children,
}: {
  tone: "dark" | "light" | "muted";
  children: ReactNode;
}) {
  const toneClasses =
    tone === "dark"
      ? "bg-navy-950 text-ivory-50"
      : tone === "muted"
        ? "bg-navy-950/[0.02] text-navy-950"
        : "bg-white text-navy-950";
  return <div className={`border-t border-navy-950/5 px-5 py-5 text-center first:border-t-0 ${toneClasses}`}>{children}</div>;
}

/**
 * Live "roughly what guests will see" preview shown alongside Event
 * Settings, updating on every keystroke and every section reorder/show-
 * hide toggle — no save required. Deliberately NOT a pixel-perfect
 * render of the event's active visual template (see /admin/templates
 * and templates/ for that — templates only swap CSS variables + an
 * animation personality, and reproducing that here would mean loading
 * a template's CSS into an admin page that isn't itself templated).
 * Instead this renders schematic stand-ins for every homepage section —
 * same order/visibility as `data.sectionConfig` (kept in sync with
 * SectionOrderManager via its onChange prop, so a hide/show or drag
 * reflects here immediately, before "Save Section Order" is even
 * pressed) — against the platform's default navy/gold/ivory brand
 * shell, so an admin gets instant feedback on both content and
 * structure while editing.
 */
export function EventSettingsPreview({ data }: { data: EventSettingsPreviewData }) {
  const wishCopy = getWishSectionCopy(data.category);
  const dateLabel = formatPreviewDate(data.startAt);
  const trimmedWish = data.wishMessage.trim();
  const config = normalizeSectionConfig(data.sectionConfig);

  const sectionsByKey: Record<SectionKey, ReactNode> = {
    countdown: (
      <PreviewSectionShell tone="muted">
        <p className={previewLabel}>Counting Down</p>
        <div className="mx-auto mt-2 flex max-w-[220px] justify-center gap-2">
          {["Days", "Hrs", "Min", "Sec"].map((unit) => (
            <div key={unit} className="flex-1 rounded-lg border border-navy-950/10 bg-white py-2">
              <p className="font-display text-sm text-navy-950">
                <Clock size={11} className="mx-auto mb-0.5 text-gold-600" />
                00
              </p>
              <p className="text-[8px] uppercase tracking-wide text-navy-700/50">{unit}</p>
            </div>
          ))}
        </div>
      </PreviewSectionShell>
    ),
    invitation: (
      <PreviewSectionShell tone="light">
        <p className={previewLabel}>You&rsquo;re Invited</p>
        <p className="mt-2 font-display text-base italic text-navy-950">
          Join us in celebrating {data.honoreeName || "the honoree"}
        </p>
        <span className="mt-3 inline-block rounded-full bg-gold-500 px-4 py-1.5 text-[11px] font-medium text-navy-950">
          View Invitation
        </span>
      </PreviewSectionShell>
    ),
    eventDetails: (
      <PreviewSectionShell tone="muted">
        <p className={previewLabel}>Event Details</p>
        <div className="mt-2.5 grid gap-1.5 text-[11px] text-navy-700/80">
          <p className="flex items-center justify-center gap-1.5">
            <CalendarDays size={12} className="text-gold-600" /> {dateLabel || "Date & time"}
          </p>
          <p className="flex items-center justify-center gap-1.5">
            <MapPin size={12} className="text-gold-600" /> {data.venueName || "Venue"}
          </p>
          {data.dressCode ? (
            <p className="flex items-center justify-center gap-1.5">
              <Shirt size={12} className="text-gold-600" /> {data.dressCode}
            </p>
          ) : null}
          {data.parkingInfo ? (
            <p className="flex items-center justify-center gap-1.5">
              <Car size={12} className="text-gold-600" /> {data.parkingInfo}
            </p>
          ) : null}
        </div>
      </PreviewSectionShell>
    ),
    liveStream: (
      <PreviewSectionShell tone="dark">
        <p className={previewLabel}>Live Now</p>
        <div className="mx-auto mt-2.5 flex max-w-[220px] aspect-video items-center justify-center rounded-lg border border-white/10 bg-black/30">
          <Radio size={16} className="text-red-400" />
        </div>
      </PreviewSectionShell>
    ),
    gallery: (
      <PreviewSectionShell tone="light">
        <p className={previewLabel}>Gallery</p>
        <div className="mx-auto mt-2.5 grid max-w-[220px] grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-md bg-gradient-to-br from-gold-300/40 to-navy-900/20"
            />
          ))}
        </div>
      </PreviewSectionShell>
    ),
    timeline: (
      <PreviewSectionShell tone="muted">
        <p className={previewLabel}>Timeline</p>
        <div className="mx-auto mt-3 flex max-w-[180px] flex-col gap-2.5 border-l border-gold-500/40 pl-3 text-left">
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative">
              <span className="absolute -left-[15px] top-1 h-2 w-2 rounded-full bg-gold-500" />
              <div className="h-1.5 w-16 rounded bg-navy-950/10" />
            </div>
          ))}
        </div>
      </PreviewSectionShell>
    ),
    rsvp: (
      <PreviewSectionShell tone="light">
        <p className={previewLabel}>RSVP</p>
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {["Coming", "Maybe", "Not Coming"].map((label) => (
            <span
              key={label}
              className="flex items-center gap-1 rounded-full border border-navy-950/10 px-2.5 py-1 text-[10px] text-navy-700/70"
            >
              <CheckCircle2 size={10} className="text-gold-600" /> {label}
            </span>
          ))}
        </div>
      </PreviewSectionShell>
    ),
    wishMessage: (
      <PreviewSectionShell tone="light">
        {trimmedWish ? (
          <>
            <p className={previewLabel}>{wishCopy.eyebrow}</p>
            <p className="mt-2 whitespace-pre-wrap font-display text-sm italic leading-relaxed text-navy-700/85">
              &ldquo;{trimmedWish}&rdquo;
            </p>
          </>
        ) : (
          <p className="text-[11px] text-navy-700/40">
            Add a {wishCopy.title.toLowerCase()} above to preview it here.
          </p>
        )}
      </PreviewSectionShell>
    ),
    memoryWall: (
      <PreviewSectionShell tone="muted">
        <p className={previewLabel}>Memory Wall</p>
        <div className="mx-auto mt-2.5 grid max-w-[220px] grid-cols-2 gap-1.5">
          {["Photo", "Video", "Note", "Audio"].map((label) => (
            <div
              key={label}
              className="flex items-center justify-center gap-1 rounded-md border border-navy-950/10 bg-white py-2 text-[9px] text-navy-700/60"
            >
              <Images size={10} className="text-gold-600" /> {label}
            </div>
          ))}
        </div>
      </PreviewSectionShell>
    ),
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-950/10 bg-navy-950 shadow-lg">
      <div className="border-b border-gold-500/20 px-3 py-2">
        <p className="text-center text-[10px] font-medium uppercase tracking-[0.2em] text-gold-400/70">
          Live Preview
        </p>
      </div>

      <div className="grid gap-0.5 bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 px-5 py-9 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold-400/80">
          Hosted by {data.hostedBy || "…"}
        </p>
        <h3 className="mt-2 text-balance font-display text-2xl leading-tight text-ivory-50">
          {data.honoreeName || "Honoree Name"}
        </h3>
        {data.eventTitle ? (
          <p className="mt-1.5 font-display text-sm italic text-gold-300">{data.eventTitle}</p>
        ) : null}
        {data.occasion ? <p className="mt-2 text-xs text-ivory-50/70">{data.occasion}</p> : null}
      </div>

      <div className="max-h-[70vh] overflow-y-auto">
        {config
          .filter((item) => item.visible)
          .map((item) => (
            <Fragment key={item.key}>{sectionsByKey[item.key]}</Fragment>
          ))}
      </div>
    </div>
  );
}
