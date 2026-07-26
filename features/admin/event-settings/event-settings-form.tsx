"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateEventAction } from "@/features/admin/event-settings/actions";
import {
  DEFAULT_INVITE_MESSAGE_TEMPLATE,
  INVITE_TEMPLATE_PLACEHOLDERS,
  previewInviteMessage,
} from "@/lib/whatsapp";
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
    inviteMessageTemplate: event.inviteMessageTemplate ?? "",
    publicRsvpEnabled: event.publicRsvpEnabled,
  });
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedRsvpLink, setCopiedRsvpLink] = useState(false);

  function copyRsvpLink() {
    navigator.clipboard.writeText(`${origin}/events/${event.slug}/rsvp`);
    setCopiedRsvpLink(true);
    setTimeout(() => setCopiedRsvpLink(false), 1500);
  }

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
      inviteMessageTemplate: form.inviteMessageTemplate || null,
      publicRsvpEnabled: form.publicRsvpEnabled,
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

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">WhatsApp Invite Message</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          Customize the wording sent when an admin taps WhatsApp next to a
          guest on the Invitees page. Leave blank to use the default
          wording. Use these placeholders — they&rsquo;re swapped in per
          guest:
        </p>
        <div className="flex flex-wrap gap-2">
          {INVITE_TEMPLATE_PLACEHOLDERS.map((p) => (
            <code
              key={p.token}
              title={p.description}
              className="rounded-md bg-navy-950/5 px-2 py-1 text-xs text-navy-700"
            >
              {p.token}
            </code>
          ))}
        </div>
        <div>
          <label className={labelClasses}>Message Template (optional)</label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-[110px] resize-y font-mono text-xs`}
            placeholder={DEFAULT_INVITE_MESSAGE_TEMPLATE}
            value={form.inviteMessageTemplate}
            onChange={(e) => set("inviteMessageTemplate", e.target.value)}
          />
        </div>
        <div>
          <span className={labelClasses}>Preview</span>
          <div className="mt-1.5 whitespace-pre-wrap rounded-lg border border-dashed border-navy-950/15 bg-navy-950/[0.02] p-3 text-xs text-navy-700">
            {previewInviteMessage(form.inviteMessageTemplate, form.hostedBy, form.honoreeName)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Public RSVP Link</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          By default, RSVPs only work through each guest&rsquo;s personal
          invitation link. If you can&rsquo;t collect everyone&rsquo;s contact
          details ahead of time to send individual links, turn this on to get
          a single shareable RSVP link instead — anyone with the link can
          submit their own RSVP, matched by phone number if they come back to
          update it. Trade-off: it&rsquo;s less precise than personal links
          (no per-guest open/visit tracking, and a mistyped phone number could
          overwrite someone else&rsquo;s response), so only turn it on if
          sending individual links genuinely isn&rsquo;t practical for this
          event.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, publicRsvpEnabled: false }));
              setSaved(false);
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
              !form.publicRsvpEnabled
                ? "border-gold-500 bg-gold-500/10 text-gold-700"
                : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
            }`}
          >
            Off — personal links only
          </button>
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, publicRsvpEnabled: true }));
              setSaved(false);
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
              form.publicRsvpEnabled
                ? "border-gold-500 bg-gold-500/10 text-gold-700"
                : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
            }`}
          >
            On — shared RSVP link
          </button>
        </div>
        {form.publicRsvpEnabled && origin ? (
          <div>
            <label className={labelClasses}>Shareable RSVP Link</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                readOnly
                value={`${origin}/events/${event.slug}/rsvp`}
                className={`${inputClasses} bg-navy-950/[0.02] text-navy-700/80`}
              />
              <Button type="button" variant="outline" onClick={copyRsvpLink}>
                {copiedRsvpLink ? <Check size={15} /> : <Copy size={15} />}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-navy-700/50">
              Share this on WhatsApp status, a flyer, or anywhere else — every
              visitor can RSVP themselves.
            </p>
          </div>
        ) : null}
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
