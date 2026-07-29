"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EVENT_CATEGORY_OPTIONS } from "@/lib/event-category";
import { istInputValueToUtcIso, utcIsoToIstInputValue } from "@/lib/timezone";
import type { EventRecord } from "@/types/event";
import type { EventUpdateInput } from "@/services/events";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

// Event start/end datetime-local fields are pinned to IST (see
// lib/timezone.ts) rather than the wizard host's browser timezone —
// otherwise the same event shows different times depending on where
// it's edited/viewed.

export type DraftUpdateEventAction = (
  token: string,
  eventId: string,
  input: EventUpdateInput,
) => Promise<{ success: true } | { success: false; error: string }>;

interface EventBasicsFormProps {
  token: string;
  event: EventRecord;
  updateAction: DraftUpdateEventAction;
  /** Wizard step to navigate to after a successful save, e.g. "/start/TOKEN/template". */
  nextHref?: string;
}

/**
 * A smaller, wizard-only sibling of features/admin/event-settings/event-settings-form.tsx
 * — covers just what a new host needs to describe their event, not the
 * full admin form's AI CSS / WhatsApp template / public RSVP link /
 * homepage-section-ordering sections, which stay in the real dashboard
 * once the account exists. See CLAUDE.md / session notes for why this
 * is a dedicated component rather than a refactor of the full form.
 */
export function EventBasicsForm({ token, event, updateAction, nextHref }: EventBasicsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    category: event.category,
    occasion: event.occasion ?? "",
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    hostedBy: event.hostedBy,
    startAt: utcIsoToIstInputValue(event.startAt),
    endAt: utcIsoToIstInputValue(event.endAt),
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    mapsUrl: event.mapsUrl ?? "",
    parkingInfo: event.parkingInfo ?? "",
    dressCode: event.dressCode ?? "",
    visibility: event.visibility,
    additionalNotes: event.additionalNotes ?? "",
    wishMessage: event.wishMessage ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const result = await updateAction(token, event.id, {
      category: form.category,
      occasion: form.occasion || null,
      honoreeName: form.honoreeName,
      eventTitle: form.eventTitle,
      hostedBy: form.hostedBy,
      startAt: istInputValueToUtcIso(form.startAt),
      endAt: istInputValueToUtcIso(form.endAt),
      venueName: form.venueName || null,
      venueAddress: form.venueAddress || null,
      mapsUrl: form.mapsUrl || null,
      parkingInfo: form.parkingInfo || null,
      dressCode: form.dressCode || null,
      visibility: form.visibility,
      additionalNotes: form.additionalNotes || null,
      wishMessage: form.wishMessage || null,
    });

    setSaving(false);
    if (result.success) {
      setSaved(true);
      if (nextHref) {
        router.push(nextHref);
      } else {
        router.refresh();
      }
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-6">
      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Who &amp; What</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Event Type</label>
            <select
              className={`${inputClasses} mt-1.5`}
              value={form.category}
              onChange={(e) => set("category", e.target.value as EventRecord["category"])}
            >
              {EVENT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClasses}>Occasion (optional)</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.occasion}
              onChange={(e) => set("occasion", e.target.value)}
              placeholder="e.g. 75th Birthday"
            />
          </div>
          <div>
            <label className={labelClasses}>Honoree / Guest of Honor</label>
            <input
              required
              className={`${inputClasses} mt-1.5`}
              value={form.honoreeName}
              onChange={(e) => set("honoreeName", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Tagline</label>
            <input
              required
              className={`${inputClasses} mt-1.5`}
              value={form.eventTitle}
              onChange={(e) => set("eventTitle", e.target.value)}
              placeholder="e.g. 75 Years of Love"
            />
          </div>
          <div>
            <label className={labelClasses}>Hosted By</label>
            <input
              required
              className={`${inputClasses} mt-1.5`}
              value={form.hostedBy}
              onChange={(e) => set("hostedBy", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Visibility</label>
            <select
              className={`${inputClasses} mt-1.5`}
              value={form.visibility}
              onChange={(e) => set("visibility", e.target.value as EventRecord["visibility"])}
            >
              <option value="private">Private — only reachable by direct link</option>
              <option value="public">Public — listed in the events directory</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Date &amp; Time</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          Times are in India Standard Time (IST), regardless of your own
          device&rsquo;s timezone.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Starts</label>
            <input
              required
              type="datetime-local"
              className={`${inputClasses} mt-1.5`}
              value={form.startAt}
              onChange={(e) => set("startAt", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Ends</label>
            <input
              required
              type="datetime-local"
              className={`${inputClasses} mt-1.5`}
              value={form.endAt}
              onChange={(e) => set("endAt", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Venue Name</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.venueName}
              onChange={(e) => set("venueName", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Address</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.venueAddress}
              onChange={(e) => set("venueAddress", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Google Maps Link</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.mapsUrl}
              onChange={(e) => set("mapsUrl", e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div>
            <label className={labelClasses}>Parking Info</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.parkingInfo}
              onChange={(e) => set("parkingInfo", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Dress Code</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.dressCode}
              onChange={(e) => set("dressCode", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Notices &amp; Wish Message</h2>
        <div>
          <label className={labelClasses}>Notices (one per line — e.g. &ldquo;No gifts please&rdquo;)</label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-20`}
            value={form.additionalNotes}
            onChange={(e) => set("additionalNotes", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClasses}>Wish Message</label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-20`}
            value={form.wishMessage}
            onChange={(e) => set("wishMessage", e.target.value)}
          />
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save &amp; Continue
        </Button>
        {saved ? <span className="text-sm text-navy-700/60">Saved.</span> : null}
      </div>
    </form>
  );
}
