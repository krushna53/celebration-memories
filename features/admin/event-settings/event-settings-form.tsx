"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateEventAction } from "@/features/admin/event-settings/actions";
import type { EventRecord } from "@/types/event";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface EventSettingsFormProps {
  event: EventRecord;
}

/** Converts an ISO timestamp to the value a <input type="datetime-local"> expects. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventSettingsForm({ event }: EventSettingsFormProps) {
  const [form, setForm] = useState({
    occasion: event.occasion ?? "",
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    hostedBy: event.hostedBy,
    startAt: toLocalInputValue(event.startAt),
    endAt: toLocalInputValue(event.endAt),
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    mapsUrl: event.mapsUrl ?? "",
    mapsEmbedUrl: event.mapsEmbedUrl ?? "",
    parkingInfo: event.parkingInfo ?? "",
    dressCode: event.dressCode ?? "",
    visibility: event.visibility,
    shortDescription: event.shortDescription ?? "",
    occasionDate: event.occasionDate ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updateEventAction(event.id, {
      occasion: form.occasion || null,
      honoreeName: form.honoreeName,
      eventTitle: form.eventTitle,
      hostedBy: form.hostedBy,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      venueName: form.venueName || null,
      venueAddress: form.venueAddress || null,
      mapsUrl: form.mapsUrl || null,
      mapsEmbedUrl: form.mapsEmbedUrl || null,
      parkingInfo: form.parkingInfo || null,
      dressCode: form.dressCode || null,
      visibility: form.visibility,
      shortDescription: form.shortDescription || null,
      occasionDate: form.occasionDate || null,
    });

    setSaving(false);
    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-3xl gap-8">
      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Who &amp; What</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Hosted For (Honoree)</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.honoreeName}
              onChange={(e) => set("honoreeName", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClasses}>Hosted By</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.hostedBy}
              onChange={(e) => set("hostedBy", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClasses}>Occasion</label>
            <input
              className={`${inputClasses} mt-1.5`}
              placeholder="e.g. 75th Birthday Celebration"
              value={form.occasion}
              onChange={(e) => set("occasion", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Tagline (optional)</label>
            <input
              className={`${inputClasses} mt-1.5`}
              placeholder="e.g. 75 Years of Love"
              value={form.eventTitle}
              onChange={(e) => set("eventTitle", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Date &amp; Time</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          &ldquo;Starts / Ends&rdquo; is when the <em>celebration</em> takes place —
          this drives the countdown, RSVP window, and everywhere a date/time
          shows on the site. If the actual occasion (e.g. a real birthdate or
          anniversary date) falls on a different day than the party, add it
          separately below — it&rsquo;s optional and purely informational.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Celebration Starts</label>
            <input
              type="datetime-local"
              className={`${inputClasses} mt-1.5`}
              value={form.startAt}
              onChange={(e) => set("startAt", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClasses}>Celebration Ends</label>
            <input
              type="datetime-local"
              className={`${inputClasses} mt-1.5`}
              value={form.endAt}
              onChange={(e) => set("endAt", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClasses}>Actual Occasion Date (optional)</label>
            <input
              type="date"
              className={`${inputClasses} mt-1.5`}
              value={form.occasionDate}
              onChange={(e) => set("occasionDate", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-navy-700/50">
              e.g. Mahesh&rsquo;s real birthdate, if the party is held on a
              different day.
            </p>
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
            <label className={labelClasses}>Venue Address</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.venueAddress}
              onChange={(e) => set("venueAddress", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Google Maps Directions URL</label>
            <input
              className={`${inputClasses} mt-1.5`}
              placeholder="https://maps.google.com/..."
              value={form.mapsUrl}
              onChange={(e) => set("mapsUrl", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClasses}>Google Maps Embed URL</label>
            <input
              className={`${inputClasses} mt-1.5`}
              placeholder="https://www.google.com/maps/embed?..."
              value={form.mapsEmbedUrl}
              onChange={(e) => set("mapsEmbedUrl", e.target.value)}
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
        <h2 className="font-display text-lg text-navy-950">Public Listing</h2>
        <div>
          <label className={labelClasses}>Visibility</label>
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, visibility: "public" }));
                setSaved(false);
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
                form.visibility === "public"
                  ? "border-gold-500 bg-gold-500/10 text-gold-700"
                  : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
              }`}
            >
              Public — listed on /events
            </button>
            <button
              type="button"
              onClick={() => {
                setForm((f) => ({ ...f, visibility: "private" }));
                setSaved(false);
              }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
                form.visibility === "private"
                  ? "border-gold-500 bg-gold-500/10 text-gold-700"
                  : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
              }`}
            >
              Private — link only
            </button>
          </div>
          <p className="mt-2 text-xs text-navy-700/60">
            Either way, the site is always reachable at its direct link — this only
            controls whether it shows up in the public events directory.
          </p>
        </div>
        <div>
          <label className={labelClasses}>Short Description (for the directory card)</label>
          <input
            className={`${inputClasses} mt-1.5`}
            placeholder="e.g. A joyful evening celebrating 75 years, with family and friends."
            value={form.shortDescription}
            onChange={(e) => set("shortDescription", e.target.value)}
            maxLength={160}
          />
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Saving...
            </>
          ) : (
            <>
              <Save size={16} /> Save Changes
            </>
          )}
        </Button>
        {saved ? <span className="text-sm text-green-700">Saved.</span> : null}
      </div>
    </form>
  );
}
