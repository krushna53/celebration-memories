"use client";

import { getWishSectionCopy } from "@/lib/event-category";
import type { EventRecord } from "@/types/event";

export interface EventSettingsPreviewData {
  honoreeName: string;
  hostedBy: string;
  eventTitle: string;
  occasion: string;
  startAt: string;
  venueName: string;
  wishMessage: string;
  category: EventRecord["category"];
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

/**
 * Live "roughly what guests will see" preview shown alongside Event
 * Settings, updating on every keystroke — no save required. Deliberately
 * NOT a pixel-perfect render of the event's active visual template (see
 * /admin/templates and templates/ for that — templates only swap CSS
 * variables + an animation personality, and reproducing that here would
 * mean loading a template's CSS into an admin page that isn't itself
 * templated). Instead this renders the same Hero + Wish Message copy
 * against the platform's default navy/gold/ivory brand shell, so an
 * admin gets instant feedback on the actual content — name, tagline,
 * host, date, venue, wish message — while typing.
 */
export function EventSettingsPreview({ data }: { data: EventSettingsPreviewData }) {
  const wishCopy = getWishSectionCopy(data.category);
  const dateLabel = formatPreviewDate(data.startAt);
  const trimmedWish = data.wishMessage.trim();

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
        {dateLabel ? (
          <p className="mt-3 text-xs font-medium tracking-wide text-gold-400">{dateLabel}</p>
        ) : null}
        {data.venueName ? <p className="mt-1 text-[11px] text-ivory-50/60">{data.venueName}</p> : null}
      </div>

      {trimmedWish ? (
        <div className="bg-white px-5 py-6 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gold-600">
            {wishCopy.eyebrow}
          </p>
          <p className="mt-2 whitespace-pre-wrap font-display text-sm italic leading-relaxed text-navy-700/85">
            &ldquo;{trimmedWish}&rdquo;
          </p>
        </div>
      ) : (
        <div className="bg-navy-950/[0.02] px-5 py-5 text-center">
          <p className="text-[11px] text-navy-700/40">
            Add a {wishCopy.title.toLowerCase()} above to preview it here.
          </p>
        </div>
      )}
    </div>
  );
}
