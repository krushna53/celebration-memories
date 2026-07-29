"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Film,
  ImagePlus,
  Loader2,
  MessageCircle,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import {
  confirmShareImageUploadAction,
  confirmShareVideoUploadAction,
  generateCustomCssAction,
  removeShareImageAction,
  removeShareVideoAction,
  requestShareImageUploadUrlAction,
  requestShareVideoUploadUrlAction,
  updateEventAction,
} from "@/features/admin/event-settings/actions";
import { SectionOrderManager } from "@/features/admin/event-settings/section-order-manager";
import {
  DEFAULT_INVITE_MESSAGE_TEMPLATE,
  INVITE_TEMPLATE_PLACEHOLDERS,
  previewInviteMessage,
} from "@/lib/whatsapp";
import { EVENT_CATEGORY_OPTIONS, getWishSectionCopy } from "@/lib/event-category";
import { validateCustomCss } from "@/lib/custom-css";
import type { EventRecord } from "@/types/event";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface EventSettingsFormProps {
  event: EventRecord;
  shareImageUrl: string | null;
  shareVideoUrl: string | null;
  aiCssConfigured: boolean;
  aiCssQuota: { used: number; limit: number } | null;
}

/** Converts an ISO timestamp to the value a <input type="datetime-local"> expects. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventSettingsForm({
  event,
  shareImageUrl,
  shareVideoUrl,
  aiCssConfigured,
  aiCssQuota,
}: EventSettingsFormProps) {
  const [form, setForm] = useState({
    category: event.category,
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
    publicMemoriesEnabled: event.publicMemoriesEnabled,
    additionalNotes: event.additionalNotes ?? "",
    wishMessage: event.wishMessage ?? "",
    customCss: event.customCss ?? "",
  });
  const [customCssError, setCustomCssError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedWebPageLink, setCopiedWebPageLink] = useState(false);
  const [copiedRsvpLink, setCopiedRsvpLink] = useState(false);
  const [copiedMemoriesLink, setCopiedMemoriesLink] = useState(false);
  const [copiedDisplayLink, setCopiedDisplayLink] = useState(false);
  const [uploadingShareImage, setUploadingShareImage] = useState(false);
  const [shareImageError, setShareImageError] = useState<string | null>(null);
  const shareImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingShareVideo, setUploadingShareVideo] = useState(false);
  const [shareVideoError, setShareVideoError] = useState<string | null>(null);
  const shareVideoInputRef = useRef<HTMLInputElement>(null);
  const [aiCssPrompt, setAiCssPrompt] = useState("");
  const [generatingCss, setGeneratingCss] = useState(false);
  const [aiCssGenError, setAiCssGenError] = useState<string | null>(null);
  const [aiCssRemaining, setAiCssRemaining] = useState<number | null>(
    aiCssQuota ? Math.max(aiCssQuota.limit - aiCssQuota.used, 0) : null,
  );

  function copyWebPageLink() {
    navigator.clipboard.writeText(`${origin}/events/${event.slug}`);
    setCopiedWebPageLink(true);
    setTimeout(() => setCopiedWebPageLink(false), 1500);
  }

  function shareWebPageLinkViaWhatsApp() {
    const link = `${origin}/events/${event.slug}`;
    const text = `${event.hostedBy} warmly invites you to celebrate ${event.honoreeName}'s ${event.eventTitle}: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function copyRsvpLink() {
    navigator.clipboard.writeText(`${origin}/events/${event.slug}/rsvp`);
    setCopiedRsvpLink(true);
    setTimeout(() => setCopiedRsvpLink(false), 1500);
  }

  function shareRsvpLinkViaWhatsApp() {
    const link = `${origin}/events/${event.slug}/rsvp`;
    const text = `Please RSVP for ${event.honoreeName}'s ${event.eventTitle} here: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function copyMemoriesLink() {
    navigator.clipboard.writeText(`${origin}/events/${event.slug}/memories`);
    setCopiedMemoriesLink(true);
    setTimeout(() => setCopiedMemoriesLink(false), 1500);
  }

  function shareMemoriesLinkViaWhatsApp() {
    const link = `${origin}/events/${event.slug}/memories`;
    const text = `${event.hostedBy} would love a photo or video memory of ${event.honoreeName} — upload one here: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function copyDisplayLink() {
    navigator.clipboard.writeText(`${origin}/events/${event.slug}/display`);
    setCopiedDisplayLink(true);
    setTimeout(() => setCopiedDisplayLink(false), 1500);
  }

  function shareDisplayLinkViaWhatsApp() {
    const link = `${origin}/events/${event.slug}/display`;
    const text = `Open this on the TV/projector at the venue for a full-screen slideshow of ${event.honoreeName}'s photos, timeline, and shared memories: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function handleShareImageFile(rawFile: File) {
    setUploadingShareImage(true);
    setShareImageError(null);
    try {
      const file = await compressImage(rawFile);
      const signed = await requestShareImageUploadUrlAction(event.id, file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(uploadError.message);

      const confirmed = await confirmShareImageUploadAction(event.id, path);
      if (!confirmed.success) throw new Error(confirmed.error);

      window.location.reload();
    } catch (err) {
      setShareImageError(err instanceof Error ? err.message : "Upload failed.");
      setUploadingShareImage(false);
    }
  }

  async function handleRemoveShareImage() {
    if (!confirm("Remove the link preview image?")) return;
    setUploadingShareImage(true);
    const result = await removeShareImageAction(event.id);
    if (result.success) {
      window.location.reload();
    } else {
      setShareImageError(result.error);
      setUploadingShareImage(false);
    }
  }

  async function handleShareVideoFile(file: File) {
    setUploadingShareVideo(true);
    setShareVideoError(null);
    try {
      if (file.type !== "video/mp4") {
        throw new Error("Only MP4 video is supported.");
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("File is too large — link-preview videos are limited to 20MB.");
      }

      const signed = await requestShareVideoUploadUrlAction(event.id, file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(uploadError.message);

      const confirmed = await confirmShareVideoUploadAction(event.id, path);
      if (!confirmed.success) throw new Error(confirmed.error);

      window.location.reload();
    } catch (err) {
      setShareVideoError(err instanceof Error ? err.message : "Upload failed.");
      setUploadingShareVideo(false);
    }
  }

  async function handleRemoveShareVideo() {
    if (!confirm("Remove the link preview video?")) return;
    setUploadingShareVideo(true);
    const result = await removeShareVideoAction(event.id);
    if (result.success) {
      window.location.reload();
    } else {
      setShareVideoError(result.error);
      setUploadingShareVideo(false);
    }
  }

  async function handleGenerateCss() {
    setGeneratingCss(true);
    setAiCssGenError(null);
    try {
      const result = await generateCustomCssAction(event.id, aiCssPrompt);
      if (!result.success) {
        setAiCssGenError(result.error);
        return;
      }
      set("customCss", form.customCss ? `${form.customCss}\n\n${result.css}` : result.css);
      setCustomCssError(null);
      if (result.remaining !== null) setAiCssRemaining(result.remaining);
    } finally {
      setGeneratingCss(false);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.customCss) {
      const cssError = validateCustomCss(form.customCss);
      if (cssError) {
        setCustomCssError(cssError);
        return;
      }
    }
    setCustomCssError(null);
    setSaving(true);

    const result = await updateEventAction(event.id, {
      category: form.category,
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
      publicMemoriesEnabled: form.publicMemoriesEnabled,
      additionalNotes: form.additionalNotes || null,
      wishMessage: form.wishMessage || null,
      customCss: form.customCss || null,
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
            <label className={labelClasses}>Event Type</label>
            <select
              className={`${inputClasses} mt-1.5`}
              value={form.category}
              onChange={(e) => {
                setForm((f) => ({ ...f, category: e.target.value as EventRecord["category"] }));
                setSaved(false);
              }}
            >
              {EVENT_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-navy-700/50">
              Changes the wording used for the Wish Message section and Event Details notices below.
            </p>
          </div>
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
        <h2 className="font-display text-lg text-navy-950">Notices &amp; Wish Message</h2>
        <div>
          <label className={labelClasses}>
            {getWishSectionCopy(form.category).noticesTitle} (shown in Event Details)
          </label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-[90px] resize-y`}
            placeholder={"e.g. No gifts please\nDress code: Formal\nParking available on-site"}
            value={form.additionalNotes}
            onChange={(e) => set("additionalNotes", e.target.value)}
          />
          <p className="mt-1.5 text-xs text-navy-700/50">
            One line per notice — each shows as its own line on the site.
          </p>
        </div>
        <div>
          <label className={labelClasses}>
            {getWishSectionCopy(form.category).title} (its own section below RSVP)
          </label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-[90px] resize-y`}
            placeholder={getWishSectionCopy(form.category).placeholder}
            value={form.wishMessage}
            onChange={(e) => set("wishMessage", e.target.value)}
          />
          <p className="mt-1.5 text-xs text-navy-700/50">
            Optional — leave blank and this section won&rsquo;t show at all.
            Reorder or hide it like any other section under Homepage Sections below.
          </p>
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
        <h2 className="font-display text-lg text-navy-950">Homepage Sections</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          Reorder or hide sections on your public homepage — for example,
          hide Timeline until you&rsquo;ve added milestones, or move Gallery
          higher. Changes apply immediately to the live site once saved.
        </p>
        <SectionOrderManager eventId={event.id} initialConfig={event.sectionConfig} />
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Link Preview Image</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          The image shown when your site or an invite link is shared on
          WhatsApp, Facebook, X, or iMessage. Without one, we fall back to
          your oldest Gallery photo, then no image at all — upload one here
          for full control. A wide photo (1200×630 or similar) works best.
        </p>
        <div className="flex items-center gap-4">
          {shareImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={shareImageUrl}
              alt="Current link preview"
              className="h-20 w-36 rounded-lg border border-navy-950/10 object-cover"
            />
          ) : (
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-navy-950/15 text-navy-700/30">
              <ImagePlus size={22} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={shareImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleShareImageFile(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingShareImage}
              onClick={() => shareImageInputRef.current?.click()}
            >
              {uploadingShareImage ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Upload size={14} />
              )}
              {shareImageUrl ? "Replace" : "Upload"}
            </Button>
            {shareImageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploadingShareImage}
                onClick={handleRemoveShareImage}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Remove
              </Button>
            ) : null}
          </div>
        </div>
        {shareImageError ? <p className="text-sm text-red-600">{shareImageError}</p> : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Link Preview Video (optional)</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          An optional short video shown instead of the image above — but{" "}
          <strong>only on Telegram</strong>. WhatsApp, Facebook, and Messenger all ignore
          video previews entirely and will keep showing your Link Preview Image regardless —
          this is a platform limitation, not a bug. Keep the image configured above either way.
        </p>
        <div className="flex items-center gap-4">
          {shareVideoUrl ? (
            <video src={shareVideoUrl} controls className="h-20 w-36 rounded-lg border border-navy-950/10 object-cover" />
          ) : (
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-navy-950/15 text-navy-700/30">
              <Film size={22} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={shareVideoInputRef}
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleShareVideoFile(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingShareVideo}
              onClick={() => shareVideoInputRef.current?.click()}
            >
              {uploadingShareVideo ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Upload size={14} />
              )}
              {shareVideoUrl ? "Replace" : "Upload"}
            </Button>
            {shareVideoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploadingShareVideo}
                onClick={handleRemoveShareVideo}
                className="text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Remove
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-navy-700/50">MP4 only, up to 20MB — keep it short (a few seconds).</p>
        {shareVideoError ? <p className="text-sm text-red-600">{shareVideoError}</p> : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Your Event Page</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          The main site — hero, event details, gallery, timeline, RSVP, and Memory Wall all in
          one link. This is the one to put in a WhatsApp broadcast, on social media, or anywhere
          you&rsquo;d share the celebration itself.
        </p>
        {origin ? (
          <div>
            <label className={labelClasses}>Event Page Link</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                readOnly
                value={`${origin}/events/${event.slug}`}
                className={`${inputClasses} bg-navy-950/[0.02] text-navy-700/80`}
              />
              <Button type="button" variant="outline" onClick={copyWebPageLink}>
                {copiedWebPageLink ? <Check size={15} /> : <Copy size={15} />}
              </Button>
              <Button type="button" variant="outline" onClick={shareWebPageLinkViaWhatsApp}>
                <MessageCircle size={15} />
              </Button>
            </div>
          </div>
        ) : null}
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
              <Button type="button" variant="outline" onClick={shareRsvpLinkViaWhatsApp}>
                <MessageCircle size={15} />
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-navy-700/50">
              Share this on WhatsApp status, a flyer, or anywhere else — every
              visitor can RSVP themselves.
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Share-a-Memory Link</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          A single link relatives can open to upload a photo, video, or audio
          memory — no personal invitation link needed. Perfect for texting to
          family who won&rsquo;t be sent a formal invite. Just like a personal
          link, every upload waits for your approval on the Memories page
          before it appears on the public Memory Wall.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, publicMemoriesEnabled: false }));
              setSaved(false);
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
              !form.publicMemoriesEnabled
                ? "border-gold-500 bg-gold-500/10 text-gold-700"
                : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
            }`}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, publicMemoriesEnabled: true }));
              setSaved(false);
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-luxury duration-300 ${
              form.publicMemoriesEnabled
                ? "border-gold-500 bg-gold-500/10 text-gold-700"
                : "border-navy-950/15 text-navy-700/70 hover:border-navy-950/30"
            }`}
          >
            On — shared memory link
          </button>
        </div>
        {form.publicMemoriesEnabled && origin ? (
          <div>
            <label className={labelClasses}>Shareable Memories Link</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                readOnly
                value={`${origin}/events/${event.slug}/memories`}
                className={`${inputClasses} bg-navy-950/[0.02] text-navy-700/80`}
              />
              <Button type="button" variant="outline" onClick={copyMemoriesLink}>
                {copiedMemoriesLink ? <Check size={15} /> : <Copy size={15} />}
              </Button>
              <Button type="button" variant="outline" onClick={shareMemoriesLinkViaWhatsApp}>
                <MessageCircle size={15} />
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-navy-700/50">
              Opens straight to a video upload button — relatives just tap,
              record or choose a file, and send.
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Big Screen Display</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          A chrome-free, full-screen slideshow of your Gallery, Timeline, and memories shared by
          relatives — no header, footer, or navigation, just the slides on a loop. Made for a TV
          or projector at the venue: open this link there, tap to begin, and it&rsquo;ll play on
          its own.
        </p>
        {origin ? (
          <div>
            <label className={labelClasses}>Big Screen Display Link</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                readOnly
                value={`${origin}/events/${event.slug}/display`}
                className={`${inputClasses} bg-navy-950/[0.02] text-navy-700/80`}
              />
              <Button type="button" variant="outline" onClick={copyDisplayLink}>
                {copiedDisplayLink ? <Check size={15} /> : <Copy size={15} />}
              </Button>
              <Button type="button" variant="outline" onClick={shareDisplayLinkViaWhatsApp}>
                <MessageCircle size={15} />
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Custom CSS (Advanced)</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          Fine-tune colors, spacing, or fonts on your public page with your own CSS.
          Deliberately CSS-only — no JavaScript or HTML — since this is a shared platform
          and script injection would put every guest who visits your page at risk. A few
          constructs are blocked outright for the same reason:{" "}
          <code className="rounded bg-navy-950/5 px-1 py-0.5">url(...)</code>,{" "}
          <code className="rounded bg-navy-950/5 px-1 py-0.5">@import</code>, and anything
          that looks like an embedded tag or script. Applies only to your own event page.
        </p>

        {aiCssConfigured ? (
          <div className="rounded-lg border border-dashed border-navy-950/15 bg-navy-950/[0.02] p-3">
            <label className={labelClasses}>Generate with AI (optional)</label>
            <p className="mt-1 text-xs text-navy-700/50">
              Describe a style change in plain language and AI will write the CSS for you —
              it&rsquo;s appended below for you to review before saving. Still CSS-only and
              still run through the same safety check above.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                className={inputClasses}
                placeholder="e.g. make the section headings a bit larger and add more spacing"
                value={aiCssPrompt}
                onChange={(e) => setAiCssPrompt(e.target.value)}
                disabled={generatingCss}
              />
              <Button
                type="button"
                variant="outline"
                disabled={generatingCss || !aiCssPrompt.trim()}
                onClick={handleGenerateCss}
                className="shrink-0"
              >
                {generatingCss ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
                Generate
              </Button>
            </div>
            {aiCssQuota ? (
              <p className="mt-1.5 text-xs text-navy-700/50">
                {aiCssRemaining} of {aiCssQuota.limit} AI generations remaining for this event.
              </p>
            ) : null}
            {aiCssGenError ? <p className="mt-1.5 text-sm text-red-600">{aiCssGenError}</p> : null}
          </div>
        ) : (
          <p className="text-xs text-navy-700/40">
            AI-assisted generation isn&rsquo;t configured — add OPENAI_API_KEY to enable it.
            You can still hand-write CSS below.
          </p>
        )}

        <textarea
          className={`${inputClasses} min-h-[140px] resize-y font-mono text-xs`}
          placeholder={".hero-title {\n  letter-spacing: 0.05em;\n}"}
          value={form.customCss}
          onChange={(e) => {
            set("customCss", e.target.value);
            setCustomCssError(null);
          }}
        />
        {customCssError ? <p className="text-sm text-red-600">{customCssError}</p> : null}
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
