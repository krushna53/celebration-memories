"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ScanText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EVENT_CATEGORY_OPTIONS, getEventFieldCopy } from "@/lib/event-category";
import { buildEventSlugSuggestion, isValidSlug } from "@/lib/slug";
import { zonedInputValueToUtcIso, utcIsoToZonedInputValue, listSupportedTimezones } from "@/lib/timezone";
import { buildMapsEmbedUrl, buildMapsSearchUrl } from "@/lib/maps";
import { placeFullAddress, type PlaceSuggestion } from "@/lib/place-search";
import { MapEmbedPreview } from "@/components/forms/map-embed-preview";
import { VenueAutocomplete } from "@/components/forms/venue-autocomplete";
import { EventSettingsPreview } from "@/features/admin/event-settings/event-settings-preview";
import { draftDetectEventTimezoneAction } from "@/features/start/actions/event";
import { WizardBackLink } from "@/features/start/wizard-back-link";
import type { EventRecord } from "@/types/event";
import type { EventUpdateInput } from "@/services/events";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

/**
 * Start/End are stored in `form` as a single "YYYY-MM-DDTHH:mm" string
 * (the exact shape zonedInputValueToUtcIso expects), but rendered as
 * two separate native inputs (`type="date"` + `type="time"`) instead of
 * one combined `type="datetime-local"` — a single datetime-local input
 * requires BOTH the date and time sub-fields to be filled before its
 * value is considered valid at all, and a host who only picks a date
 * (the calendar widget's most natural first interaction) would find
 * the field stuck "invalid," blocking Save & Continue with a native
 * browser validation message that reads as an unexplained error. These
 * two helpers keep the combined string always fully valid the instant
 * either half is touched, by defaulting the other half rather than
 * leaving it blank.
 */
function dateOnly(value: string): string {
  return value.split("T")[0] ?? "";
}
function timeOnly(value: string): string {
  return value.split("T")[1] ?? "";
}
function combineDateTime(date: string, time: string): string {
  const d = date || new Date().toISOString().slice(0, 10);
  const t = time || "11:00";
  return `${d}T${t}`;
}

/** Stored end for a "start time only" event — never shown, just keeps "has it ended?" checks working. */
const OPEN_ENDED_DURATION_MS = 5 * 60 * 60 * 1000;

// Event start/end datetime-local fields are pinned to the event's own
// timezone (see lib/timezone.ts; defaults to Asia/Kolkata until the
// host sets a venue address and detects one in Event Settings) rather
// than the wizard host's browser timezone — otherwise the same event
// shows different times depending on where it's edited/viewed.

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
  /** True when arriving from the "Your Card" step after its details were read off the host's card — shows a "please check" banner and suggests a slug. */
  prefilledFromCard?: boolean;
}

/**
 * A smaller, wizard-only sibling of features/admin/event-settings/event-settings-form.tsx
 * — covers just what a new host needs to describe their event, not the
 * full admin form's AI CSS / WhatsApp template / public RSVP link /
 * homepage-section-ordering sections, which stay in the real dashboard
 * once the account exists. See CLAUDE.md / session notes for why this
 * is a dedicated component rather than a refactor of the full form.
 *
 * Shares the same EventSettingsPreview component as the admin form —
 * a host filling out this step without an account yet (no login) still
 * gets the same live, no-save-required preview of their homepage.
 */
export function EventBasicsForm({ token, event, updateAction, nextHref, prefilledFromCard = false }: EventBasicsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    // A still-random draft slug gets a readable suggestion from the
    // details just read off the card — only pre-filled into the field
    // for the host to review, never saved without them pressing Save.
    slug:
      prefilledFromCard && event.slug.startsWith("draft-")
        ? buildEventSlugSuggestion(event.honoreeName, event.occasion || event.eventTitle)
        : event.slug,
    category: event.category,
    occasion: event.occasion ?? "",
    honoreeName: event.honoreeName,
    eventTitle: event.eventTitle,
    hostedBy: event.hostedBy,
    startAt: utcIsoToZonedInputValue(event.startAt, event.timezone),
    endAt: utcIsoToZonedInputValue(event.endAt, event.timezone),
    hasEndTime: event.hasEndTime,
    timezone: event.timezone,
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    mapsUrl: event.mapsUrl ?? "",
    mapsEmbedUrl: event.mapsEmbedUrl ?? "",
    parkingInfo: event.parkingInfo ?? "",
    dressCode: event.dressCode ?? "",
    visibility: event.visibility,
    additionalNotes: event.additionalNotes ?? "",
    wishMessage: event.wishMessage ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [detectingTimezone, setDetectingTimezone] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Full IANA list from the runtime (see lib/timezone.ts) — computed
  // once, not on every keystroke, mirroring the admin form's own
  // timezoneOptions memo.
  const timezoneOptions = useMemo(() => {
    const options = listSupportedTimezones();
    return options.includes(form.timezone) ? options : [form.timezone, ...options];
  }, [form.timezone]);

  async function handleDetectTimezone() {
    if (!form.venueAddress.trim()) return;
    setDetectingTimezone(true);
    setTimezoneError(null);
    try {
      const result = await draftDetectEventTimezoneAction(token, event.id, form.venueAddress);
      if (result.success) {
        set("timezone", result.timezone);
      } else {
        setTimezoneError(result.error);
      }
    } finally {
      setDetectingTimezone(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  /** Fills every Location field from a place picked in the venue search — all still editable afterward. */
  function applyPlace(place: PlaceSuggestion, timezone: string | null) {
    const full = placeFullAddress(place);
    setForm((f) => ({
      ...f,
      venueName: place.name,
      venueAddress: place.address || place.name,
      mapsUrl: buildMapsSearchUrl(full),
      mapsEmbedUrl: buildMapsEmbedUrl(full),
      timezone: timezone ?? f.timezone,
    }));
    setTimezoneError(null);
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedSlug = form.slug.trim().toLowerCase();
    if (!isValidSlug(normalizedSlug)) {
      setSlugError(
        "URL slug must be 3-80 characters: lowercase letters, numbers, and hyphens only (no leading, trailing, or double hyphens).",
      );
      return;
    }
    setSlugError(null);
    setSaving(true);

    const result = await updateAction(token, event.id, {
      slug: normalizedSlug,
      category: form.category,
      occasion: form.occasion || null,
      honoreeName: form.honoreeName,
      eventTitle: form.eventTitle,
      hostedBy: form.hostedBy,
      startAt: zonedInputValueToUtcIso(form.startAt, form.timezone),
      endAt: form.hasEndTime
        ? zonedInputValueToUtcIso(form.endAt, form.timezone)
        : new Date(new Date(zonedInputValueToUtcIso(form.startAt, form.timezone)).getTime() + OPEN_ENDED_DURATION_MS).toISOString(),
      hasEndTime: form.hasEndTime,
      timezone: form.timezone,
      venueName: form.venueName || null,
      venueAddress: form.venueAddress || null,
      mapsUrl: form.mapsUrl || null,
      mapsEmbedUrl: form.mapsEmbedUrl || null,
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

  const fieldCopy = getEventFieldCopy(form.category);

  const previewData = {
    honoreeName: form.honoreeName,
    hostedBy: form.hostedBy,
    eventTitle: form.eventTitle,
    occasion: form.occasion,
    startAt: form.startAt,
    venueName: form.venueName,
    parkingInfo: form.parkingInfo,
    dressCode: form.dressCode,
    wishMessage: form.wishMessage,
    category: form.category,
    // The wizard has no section-reorder step of its own (that's an
    // Event Settings-only feature once the account exists) — the
    // preview just uses whatever's on the draft record already
    // (normalized to every section, visible, in default order, if
    // unset), same as a brand-new event would show.
    sectionConfig: event.sectionConfig,
  };

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-6">
      {prefilledFromCard ? (
        <div className="flex items-start gap-3 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4" role="status">
          <ScanText className="mt-0.5 shrink-0 text-gold-700" size={18} />
          <p className="text-sm text-navy-950">
            We&rsquo;ve filled in what we could read from your invitation card. Please check every
            field — especially the date, time and address — and fill in anything that&rsquo;s missing.
          </p>
        </div>
      ) : null}

      <details className="sticky top-2 z-20 rounded-xl border border-gold-500/25 bg-ivory-50/95 p-4 shadow-md backdrop-blur" open>
        <summary className="cursor-pointer font-display text-sm font-medium text-navy-950">
          Live Preview
        </summary>
        <div className="mt-4 max-h-[60vh] max-w-sm overflow-y-auto">
          <EventSettingsPreview data={previewData} />
        </div>
      </details>

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
            <label className={labelClasses}>{fieldCopy.honoreeLabel}</label>
            <input
              required
              className={`${inputClasses} mt-1.5`}
              value={form.honoreeName}
              onChange={(e) => set("honoreeName", e.target.value)}
              placeholder={fieldCopy.honoreePlaceholder}
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
            <label className={labelClasses}>{fieldCopy.hostedByLabel}</label>
            <input
              required
              className={`${inputClasses} mt-1.5`}
              value={form.hostedBy}
              onChange={(e) => set("hostedBy", e.target.value)}
              placeholder={fieldCopy.hostedByPlaceholder}
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
        <h2 className="font-display text-lg text-navy-950">URL Slug</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          This is your event&rsquo;s public web address — worth setting to
          something readable now, before you start sharing links. You can
          still change it later in Event Settings, but any link you&rsquo;ve
          already shared by then will stop working.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className={labelClasses}>Slug</label>
            <input
              className={`${inputClasses} mt-1.5`}
              value={form.slug}
              onChange={(e) => {
                set("slug", e.target.value);
                setSlugError(null);
              }}
              required
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              set("slug", buildEventSlugSuggestion(form.honoreeName, form.occasion || form.eventTitle));
              setSlugError(null);
            }}
          >
            Generate from Name
          </Button>
        </div>
        {slugError ? <p className="text-sm text-red-600">{slugError}</p> : null}
        {origin ? (
          <p className="text-xs text-navy-700/50">
            Your event&rsquo;s address will be{" "}
            <code className="rounded bg-navy-950/5 px-1.5 py-0.5">
              {origin}/events/{form.slug || "..."}
            </code>
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Date &amp; Time</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          Times are in the event&rsquo;s timezone ({form.timezone}), regardless
          of your own device&rsquo;s timezone — set or detect it below, under Location.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Starts</label>
            <div className="mt-1.5 flex gap-2">
              <input
                required
                type="date"
                className={inputClasses}
                value={dateOnly(form.startAt)}
                onChange={(e) => set("startAt", combineDateTime(e.target.value, timeOnly(form.startAt)))}
              />
              <input
                required
                type="time"
                className={inputClasses}
                value={timeOnly(form.startAt)}
                onChange={(e) => set("startAt", combineDateTime(dateOnly(form.startAt), e.target.value))}
              />
            </div>
          </div>
          {form.hasEndTime ? (
          <div>
            <label className={labelClasses}>Ends</label>
            <div className="mt-1.5 flex gap-2">
              <input
                required
                type="date"
                className={inputClasses}
                value={dateOnly(form.endAt)}
                onChange={(e) => set("endAt", combineDateTime(e.target.value, timeOnly(form.endAt)))}
              />
              <input
                required
                type="time"
                className={inputClasses}
                value={timeOnly(form.endAt)}
                onChange={(e) => set("endAt", combineDateTime(dateOnly(form.endAt), e.target.value))}
              />
            </div>
          </div>
          ) : null}
        </div>
        <label className="flex items-start gap-2.5 text-sm text-navy-950">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-gold-500"
            checked={form.hasEndTime}
            onChange={(e) => set("hasEndTime", e.target.checked)}
          />
          <span>
            Add an end time
            <span className="block text-xs text-navy-700/60">
              Leave this off to show just the start, e.g. &ldquo;7:00 PM onwards&rdquo;.
            </span>
          </span>
        </label>
        <p className="text-xs text-navy-700/50">
          Date and time are separate fields on purpose — picking just a date used to leave the
          combined field half-filled and block saving until a time was also set. Now, if you only
          touch one, the other defaults automatically (11:00 AM start / today&rsquo;s date) so you
          can always come back and fine-tune it.
        </p>
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Location</h2>
        <div>
          <label className={labelClasses}>Find your venue</label>
          <div className="mt-1.5">
            <VenueAutocomplete inputClassName={inputClasses} onSelect={applyPlace} />
          </div>
          <p className="mt-1.5 text-xs text-navy-700/50">
            Pick a match to fill in the venue, address, timezone and map automatically — or type them below.
          </p>
        </div>
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
            <label className={labelClasses}>Timezone</label>
            <div className="mt-1.5 flex gap-2">
              <select
                className={inputClasses}
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!form.venueAddress.trim() || detectingTimezone}
                onClick={handleDetectTimezone}
              >
                {detectingTimezone ? "Detecting…" : "Detect"}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-navy-700/50">
              Used for every date/time shown to guests. &ldquo;Detect&rdquo; looks this up from the
              Address above (no API key needed) — or pick one manually.
            </p>
            {timezoneError ? <p className="mt-1 text-xs text-red-600">{timezoneError}</p> : null}
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
          <div className="sm:col-span-2">
            <label className={labelClasses}>Map on your page</label>
            <div className="mt-1.5 flex gap-2">
              <input
                className={inputClasses}
                value={form.mapsEmbedUrl}
                onChange={(e) => set("mapsEmbedUrl", e.target.value)}
                placeholder="https://maps.google.com/maps?...&output=embed"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!form.venueAddress.trim()}
                onClick={() => {
                  const place = [form.venueName, form.venueAddress].filter((v) => v.trim()).join(", ");
                  setForm((f) => ({ ...f, mapsUrl: f.mapsUrl || buildMapsSearchUrl(place), mapsEmbedUrl: buildMapsEmbedUrl(place) }));
                  setSaved(false);
                }}
              >
                Generate
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-navy-700/50">
              &ldquo;Generate&rdquo; builds the map from the venue and address above — no API key needed.
            </p>
            {form.mapsEmbedUrl ? (
              <div className="mt-3">
                <MapEmbedPreview embedUrl={form.mapsEmbedUrl} title={form.venueName || "Venue map"} />
              </div>
            ) : null}
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
            className={`${inputClasses} mt-1.5 min-h-20 resize-none`}
            value={form.additionalNotes}
            onChange={(e) => set("additionalNotes", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClasses}>Wish Message</label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-20 resize-none`}
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

      <div className="flex items-center justify-between border-t border-navy-950/10 pt-6">
        <WizardBackLink token={token} slug="basics" goals={event.wizardGoals} />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save &amp; Continue
          </Button>
          {saved ? <span className="text-sm text-navy-700/60">Saved.</span> : null}
        </div>
      </div>
    </form>
  );
}
