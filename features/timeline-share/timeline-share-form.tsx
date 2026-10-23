"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compression";
import { supabaseBrowser } from "@/lib/supabase/client";
import { staleDeployMessage } from "@/lib/stale-deploy";
import { describePhotoFile } from "@/features/admin/timeline/photo-import";
import {
  identifyTimelineContributorAction,
  requestContributionUploadAction,
  submitTimelineContributionAction,
} from "@/features/timeline-share/actions";
import type { PublicMilestoneOption } from "@/services/timeline-contributions";

const MAX_PHOTOS = 20;
const NEW_MEMORY = "new";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface PickedPhoto {
  id: string;
  file: File;
  preview: string;
}

interface TimelineShareFormProps {
  eventSlug: string;
  honoreeName: string;
  milestones: PublicMilestoneOption[];
  /** Set when the guest arrived from their personal invite link — no name step. */
  inviteToken: string | null;
  guestName: string | null;
}

function storageKey(slug: string) {
  return `timeline-share:${slug}`;
}

/**
 * The guest side of "Add to the Timeline": pick one of the host's
 * milestones (or a memory that isn't there yet), add photos and an
 * optional story, send. Dates/places are read from each ORIGINAL photo
 * before it's compressed (compression strips them) so the host sees them
 * when reviewing. Nothing appears publicly until the host approves it.
 */
export function TimelineShareForm({ eventSlug, honoreeName, milestones, inviteToken, guestName }: TimelineShareFormProps) {
  const [token, setToken] = useState<string | null>(inviteToken);
  const [name, setName] = useState(guestName ?? "");
  const [honeypot, setHoneypot] = useState("");
  const [choice, setChoice] = useState<string | null>(milestones.length === 0 ? NEW_MEMORY : null);
  const [period, setPeriod] = useState("");
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // A public visitor who already gave their name keeps the same guest identity on this device.
  useEffect(() => {
    if (inviteToken) return;
    try {
      const saved = window.localStorage.getItem(storageKey(eventSlug));
      if (saved) {
        const parsed = JSON.parse(saved) as { token?: string; name?: string };
        if (parsed.token) {
          setToken(parsed.token);
          setName(parsed.name ?? "");
        }
      }
    } catch {
      // Private mode / blocked storage — they'll just type their name.
    }
  }, [eventSlug, inviteToken]);

  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    setError(files.length + photos.length > MAX_PHOTOS ? `Up to ${MAX_PHOTOS} photos at a time — the first ${MAX_PHOTOS} are kept.` : null);
    setPhotos((prev) => [
      ...prev,
      ...files.slice(0, Math.max(0, MAX_PHOTOS - prev.length)).map((file, i) => ({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
      })),
    ]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function ensureToken(): Promise<string | null> {
    if (token) return token;
    const result = await identifyTimelineContributorAction(eventSlug, name, honeypot);
    if (!result.success) throw new Error(result.error);
    if (!result.token) {
      // Bot trap tripped — show the thank-you without doing anything.
      setDone(true);
      return null;
    }
    setToken(result.token);
    try {
      window.localStorage.setItem(storageKey(eventSlug), JSON.stringify({ token: result.token, name: name.trim() }));
    } catch {
      // Not critical.
    }
    return result.token;
  }

  async function submit() {
    setError(null);
    if (!token && !name.trim()) return setError("Please tell us your name.");
    if (!choice) return setError("Please choose which memory your photos are from.");
    if (choice === NEW_MEMORY && !title.trim()) return setError("Please say briefly what this memory is.");
    if (photos.length === 0) return setError("Please add at least one photo.");

    try {
      setBusy("Getting ready…");
      const guestToken = await ensureToken();
      if (!guestToken) return;

      const uploaded = [];
      for (const [i, photo] of photos.entries()) {
        setBusy(`Uploading photo ${i + 1} of ${photos.length}…`);
        // Read when/where from the original before compression strips it.
        const facts = await describePhotoFile(photo.file);
        const file = await compressImage(photo.file);
        const signed = await requestContributionUploadAction(guestToken, file.name, file.type, file.size);
        if (!signed.success) throw new Error(signed.error);
        const { error: uploadError } = await supabaseBrowser()
          .storage.from(signed.data.bucket)
          .uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: signed.data.contentType });
        if (uploadError) throw new Error(uploadError.message);
        uploaded.push({ path: signed.data.path, originalName: photo.file.name, ...facts });
      }

      setBusy("Sending…");
      const result = await submitTimelineContributionAction(guestToken, {
        milestoneId: choice === NEW_MEMORY ? null : choice,
        period: choice === NEW_MEMORY ? period : null,
        title: choice === NEW_MEMORY ? title : null,
        story,
        photos: uploaded,
      });
      if (!result.success) throw new Error(result.error);
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setDone(true);
    } catch (err) {
      setError(staleDeployMessage(err) ?? (err instanceof Error ? err.message : "Something went wrong. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  function startAnother() {
    setDone(false);
    setChoice(milestones.length === 0 ? NEW_MEMORY : null);
    setPeriod("");
    setTitle("");
    setStory("");
  }

  const firstName = name.trim().split(" ")[0];

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/15 bg-white px-6 py-12 text-center shadow-sm" role="status">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
          <Check size={24} />
        </span>
        <h2 className="font-display text-2xl text-navy-950">Thank you{firstName ? `, ${firstName}` : ""}!</h2>
        <p className="max-w-sm text-sm text-navy-700/70">
          The family will look through your photos before they&rsquo;re added to {honoreeName}&rsquo;s timeline.
        </p>
        <Button type="button" variant="outline" className="mt-2" onClick={startAnother}>
          <Plus size={14} /> Share another memory
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-8 rounded-2xl border border-gold-500/15 bg-white p-5 shadow-sm sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>

      {!token ? (
        <fieldset className="space-y-2">
          <legend className="font-display text-lg text-navy-950">Your name</legend>
          <input
            className={inputClasses}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={100}
            placeholder="So the family knows who shared"
            aria-label="Your name"
          />
        </fieldset>
      ) : name ? (
        <p className="text-sm text-navy-700/70">
          Sharing as <strong className="text-navy-950">{name}</strong>
        </p>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="font-display text-lg text-navy-950">Which memory are your photos from?</legend>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {milestones.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                choice === m.id ? "border-gold-500 bg-gold-500/5 ring-1 ring-gold-500" : "border-navy-950/10 hover:border-gold-500/40"
              }`}
            >
              <input type="radio" name="memory" value={m.id} checked={choice === m.id} onChange={() => setChoice(m.id)} className="sr-only" />
              {m.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.coverUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="h-12 w-12 shrink-0 rounded-lg bg-gold-500/10" />
              )}
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wider text-gold-600">{m.period}</span>
                <span className="block truncate text-sm text-navy-950">{m.title}</span>
              </span>
            </label>
          ))}
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-2.5 transition-colors ${
              choice === NEW_MEMORY ? "border-gold-500 bg-gold-500/5 ring-1 ring-gold-500" : "border-navy-950/20 hover:border-gold-500/40"
            }`}
          >
            <input type="radio" name="memory" value={NEW_MEMORY} checked={choice === NEW_MEMORY} onChange={() => setChoice(NEW_MEMORY)} className="sr-only" />
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy-950/5 text-navy-700/60">
              <Plus size={18} />
            </span>
            <span className="text-sm text-navy-950">A memory that isn&rsquo;t here yet</span>
          </label>
        </div>

        {choice === NEW_MEMORY ? (
          <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
            <input
              className={inputClasses}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              maxLength={60}
              placeholder="When? e.g. 1985"
              aria-label="Roughly when was this?"
            />
            <input
              className={inputClasses}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="What was it? e.g. Our trip to Shimla"
              aria-label="What was this memory?"
            />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-lg text-navy-950">Your photos</legend>
        <input ref={galleryRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()} disabled={busy !== null}>
            <ImagePlus size={15} /> Choose photos
          </Button>
          <Button type="button" variant="ghost" onClick={() => cameraRef.current?.click()} disabled={busy !== null}>
            <Camera size={15} /> Photograph a print
          </Button>
        </div>
        <p className="text-xs text-navy-700/60">
          Up to {MAX_PHOTOS} photos. Old prints are welcome — just take a photo of them.
        </p>
        {photos.length > 0 ? (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {photos.map((photo) => (
              <li key={photo.id} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview} alt="" className="h-full w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  disabled={busy !== null}
                  aria-label={`Remove ${photo.file.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-navy-700 shadow ring-1 ring-navy-950/10 hover:text-red-600"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-display text-lg text-navy-950">
          The story <span className="text-sm font-normal text-navy-700/50">(optional)</span>
        </legend>
        <textarea
          className={inputClasses}
          rows={3}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          maxLength={1000}
          placeholder={`Who's in it, where it was, what you remember about ${honoreeName} that day…`}
          aria-label="The story behind these photos"
        />
      </fieldset>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-navy-700/60" aria-live="polite">
          {busy ?? "The family reviews every photo before it appears."}
        </p>
        <Button type="submit" size="lg" disabled={busy !== null}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : null}
          Send to the family
        </Button>
      </div>
    </form>
  );
}
