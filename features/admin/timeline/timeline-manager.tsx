"use client";

import { CURATED_MEDIA_ACCEPT, isVideoMedia } from "@/lib/curated-media";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, ImagePlus, Images, Loader2, Plus, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GooglePhotosButton } from "@/features/uploads/components/google-photos-button";
import { GoogleDriveButton } from "@/features/uploads/components/google-drive-button";
import { PhotoMetadataTip } from "@/features/uploads/components/photo-metadata-tip";
import { PhotoTimelineImport } from "@/features/admin/timeline/photo-timeline-import";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { formatTakenDay, formatTakenMonth, readPhotoMetadata } from "@/lib/photo-metadata";
import { describePhotoFile, mapLimited } from "@/features/admin/timeline/photo-import";
import type { TimelineMilestoneRecord } from "@/types/content";
import {
  addMilestonePhotosAction,
  confirmTimelineImageUploadAction,
  getTimelineFingerprintsAction,
  removeMilestonePhotoAction,
  createMilestoneAction,
  deleteMilestoneAction,
  describePhotoPlaceAction,
  removeTimelineImageAction,
  requestTimelineImageUploadUrlAction,
  suggestTimelineFromPhotosAction,
  updateMilestoneAction,
} from "@/features/admin/timeline/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/** See AiImageActions's doc comment — same override pattern for the self-serve wizard. */
export interface TimelineActions {
  createMilestone: typeof createMilestoneAction;
  updateMilestone: typeof updateMilestoneAction;
  deleteMilestone: typeof deleteMilestoneAction;
  requestImageUpload: typeof requestTimelineImageUploadUrlAction;
  confirmImageUpload: typeof confirmTimelineImageUploadAction;
  removeImage: typeof removeTimelineImageAction;
  describePlace: typeof describePhotoPlaceAction;
  suggestFromPhotos: typeof suggestTimelineFromPhotosAction;
  addPhotos: typeof addMilestonePhotosAction;
  removePhoto: typeof removeMilestonePhotoAction;
  getFingerprints: typeof getTimelineFingerprintsAction;
}

const DEFAULT_ACTIONS: TimelineActions = {
  createMilestone: createMilestoneAction,
  updateMilestone: updateMilestoneAction,
  deleteMilestone: deleteMilestoneAction,
  requestImageUpload: requestTimelineImageUploadUrlAction,
  confirmImageUpload: confirmTimelineImageUploadAction,
  removeImage: removeTimelineImageAction,
  describePlace: describePhotoPlaceAction,
  suggestFromPhotos: suggestTimelineFromPhotosAction,
  addPhotos: addMilestonePhotosAction,
  removePhoto: removeMilestonePhotoAction,
  getFingerprints: getTimelineFingerprintsAction,
};

/** Extra photos per "Add more photos" pick. */
const MAX_PICK = 50;

interface TimelineManagerProps {
  eventId: string;
  initialMilestones: TimelineMilestoneRecord[];
  actions?: TimelineActions;
}

const EMPTY = { period: "", title: "", description: "" };

/** What a photo's EXIF told us, in milestone-ready words. */
interface PhotoFacts {
  period: string | null;
  day: string | null;
  place: string | null;
}

/** "Taken in Lonavala, Maharashtra on 14 March 1998." — or whichever half is known. */
function describeFacts(facts: PhotoFacts): string | null {
  if (facts.place && facts.day) return `Taken in ${facts.place} on ${facts.day}.`;
  if (facts.place) return `Taken in ${facts.place}.`;
  if (facts.day) return `Taken on ${facts.day}.`;
  return null;
}

/**
 * A Server Action call from a page loaded before the latest deploy fails
 * with "Failed to find Server Action" — the only fix is reloading, so say
 * that instead of a cryptic error (or, worse, silently stalling).
 */
export function staleDeployMessage(err: unknown): string | null {
  const text = err instanceof Error ? err.message : String(err);
  return /server action/i.test(text)
    ? "EveryMoment was updated while this page was open. Please reload the page and try again."
    : null;
}

export function TimelineManager({ eventId, initialMilestones, actions = DEFAULT_ACTIONS }: TimelineManagerProps) {
  const [milestones, setMilestones] = useState([...initialMilestones].sort((a, b) => a.sortOrder - b.sortOrder));
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageBusyId, setImageBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingMilestoneId = useRef<string | null>(null);
  const startPhotoInputRef = useRef<HTMLInputElement>(null);
  // "Start from a photo": the picked file waits here until Add Milestone, then gets attached.
  const [startPhoto, setStartPhoto] = useState<{
    file: File;
    preview: string;
    facts: PhotoFacts;
  } | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  // "Add more photos" in progress on one milestone.
  const [extraBusy, setExtraBusy] = useState<{ id: string; message: string } | null>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);
  const extraMilestoneId = useRef<string | null>(null);

  /** Date + place for a photo, from its EXIF (and a reverse-geocode of its GPS). Never throws. */
  async function photoFacts(file: File): Promise<PhotoFacts> {
    const meta = await readPhotoMetadata(file);
    let place: string | null = null;
    if (meta.lat !== null && meta.lon !== null) {
      const result = await actions.describePlace(eventId, meta.lat, meta.lon).catch(() => null);
      place = result?.success ? result.data.place : null;
    }
    return {
      period: meta.takenAt ? formatTakenMonth(meta.takenAt) : null,
      day: meta.takenAt ? formatTakenDay(meta.takenAt) : null,
      place,
    };
  }

  async function handleStartPhoto(file: File) {
    setReadingPhoto(true);
    const facts = await photoFacts(file);
    setReadingPhoto(false);
    if (startPhoto) URL.revokeObjectURL(startPhoto.preview);
    setStartPhoto({ file, preview: URL.createObjectURL(file), facts });
    // Only fill what's still empty — never overwrite something the host already typed.
    setForm((f) => ({
      period: f.period || facts.period || "",
      title: f.title || (facts.place ? `In ${facts.place.split(",")[0]}` : ""),
      description: f.description || describeFacts(facts) || "",
    }));
  }

  function clearStartPhoto() {
    if (startPhoto) URL.revokeObjectURL(startPhoto.preview);
    setStartPhoto(null);
  }

  async function handleAdd() {
    if (!form.period.trim() || !form.title.trim() || !form.description.trim()) return;
    setBusy(true);
    const result = await actions.createMilestone({
      eventId,
      ...form,
      sortOrder: milestones.length,
    });
    if (!result.success) {
      setBusy(false);
      alert(result.error);
      return;
    }
    if (startPhoto) {
      try {
        await uploadToMilestone(result.data.id, startPhoto.file);
      } catch (err) {
        alert(
          `The milestone was added, but its photo couldn't be uploaded: ${err instanceof Error ? err.message : "Upload failed."}`,
        );
      }
    }
    setBusy(false);
    setForm(EMPTY);
    window.location.reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this milestone?")) return;
    setBusyId(id);
    const result = await actions.deleteMilestone(id);
    setBusyId(null);
    if (result.success) {
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } else {
      alert(result.error);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= milestones.length) return;

    const reordered = [...milestones];
    const a = reordered[index];
    const b = reordered[target];
    if (!a || !b) return;
    reordered[index] = b;
    reordered[target] = a;
    setMilestones(reordered);

    setBusy(true);
    await Promise.all(reordered.map((m, i) => actions.updateMilestone(m.id, { sortOrder: i })));
    setBusy(false);
  }

  function triggerImageUpload(milestoneId: string) {
    pendingMilestoneId.current = milestoneId;
    fileInputRef.current?.click();
  }

  /** Compresses (photos only) and uploads one file to the event's timeline storage. Returns its path. Throws on failure. */
  async function uploadMedia(rawFile: File): Promise<string> {
    const file =
      rawFile.type.startsWith("video/") || isVideoMedia(rawFile.name) ? rawFile : await compressImage(rawFile);
    const signed = await actions.requestImageUpload(eventId, file.name, file.type, file.size);
    if (!signed.success) throw new Error(signed.error);

    const { bucket, path, token } = signed.data;
    const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file, {
      contentType: signed.data.contentType,
    });
    if (uploadError) throw new Error(uploadError.message);
    return path;
  }

  /** Uploads and attaches one file as a milestone's cover (its single photo/video). Throws on failure. */
  async function uploadToMilestone(milestoneId: string, rawFile: File, fingerprint?: string | null) {
    const path = await uploadMedia(rawFile);
    const confirmed = await actions.confirmImageUpload(milestoneId, path, fingerprint ?? null);
    if (!confirmed.success) throw new Error(confirmed.error);
  }

  /**
   * "Add more photos": extra photos shown with the cover on the public
   * Timeline. The cover itself is never touched. Photos already on this
   * milestone are skipped; dates/places are read from the originals first
   * (compression strips them) and widen the milestone's stored range so
   * later zip imports can find it.
   */
  async function handleAddPhotos(milestoneId: string, picked: File[]) {
    const milestone = milestones.find((m) => m.id === milestoneId);
    if (!milestone || picked.length === 0) return;
    const files = picked.slice(0, MAX_PICK);
    setExtraBusy({ id: milestoneId, message: "Reading photos…" });
    try {
      const known = new Set([milestone.imageFingerprint, ...(milestone.photos ?? []).map((p) => p.fingerprint)].filter(Boolean));
      const described = await mapLimited(files, 3, async (file) => ({ file, ...(await describePhotoFile(file)) }));
      const fresh = described.filter((d, i) => !known.has(d.fingerprint) && described.findIndex((x) => x.fingerprint === d.fingerprint) === i);

      let done = 0;
      const uploaded = await mapLimited(fresh, 3, async (d) => {
        const path = await uploadMedia(d.file);
        setExtraBusy({ id: milestoneId, message: `Uploading ${++done} of ${fresh.length}…` });
        return { path, originalName: d.file.name, takenAt: d.takenAt, lat: d.lat, lon: d.lon, fingerprint: d.fingerprint };
      });

      const days = uploaded.map((u) => u.takenAt?.slice(0, 10)).filter((d): d is string => Boolean(d)).sort();
      const gps = uploaded.find((u) => u.lat !== null && u.lon !== null);
      if (uploaded.length > 0) {
        const result = await actions.addPhotos(milestoneId, uploaded, {
          takenFrom: days[0] ?? null,
          takenTo: days[days.length - 1] ?? null,
          lat: gps?.lat ?? null,
          lon: gps?.lon ?? null,
        });
        if (!result.success) throw new Error(result.error);
      }
      const skipped = files.length - fresh.length + (picked.length - files.length);
      if (skipped > 0) {
        alert(
          `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} added. ${skipped} skipped (already on this milestone${picked.length > MAX_PICK ? `, or over ${MAX_PICK} at a time` : ""}).`,
        );
      }
      window.location.reload();
    } catch (err) {
      alert(staleDeployMessage(err) ?? (err instanceof Error ? err.message : "Upload failed."));
      setExtraBusy(null);
    }
  }

  async function handleRemoveExtra(photoId: string) {
    if (!confirm("Remove this photo from the milestone?")) return;
    const result = await actions.removePhoto(photoId).catch((err: unknown) => ({
      success: false as const,
      error: staleDeployMessage(err) ?? "Failed.",
    }));
    if (result.success) {
      setMilestones((prev) => prev.map((m) => ({ ...m, photos: (m.photos ?? []).filter((p) => p.id !== photoId) })));
    } else {
      alert(result.error);
    }
  }

  async function handleImageFile(rawFile: File) {
    const milestoneId = pendingMilestoneId.current;
    if (!milestoneId) return;

    setImageBusyId(milestoneId);
    try {
      // Read EXIF from the original — compression strips it.
      const facts = await photoFacts(rawFile);
      await uploadToMilestone(milestoneId, rawFile);

      const milestone = milestones.find((m) => m.id === milestoneId);
      const line = describeFacts(facts);
      if (milestone && line && !milestone.description.includes(line)) {
        const offer = `This photo was taken${facts.place ? ` in ${facts.place}` : ""}${facts.day ? ` on ${facts.day}` : ""}.\n\nAdd that to “${milestone.title}”'s description? You can edit it afterwards.`;
        if (confirm(offer)) {
          await actions.updateMilestone(milestoneId, {
            description: `${milestone.description.trim()} ${line}`.trim(),
          });
        }
      }

      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed.");
      setImageBusyId(null);
    }
  }

  async function handleRemoveImage(milestoneId: string) {
    if (!confirm("Remove this milestone’s photo or video?")) return;
    setImageBusyId(milestoneId);
    const result = await actions.removeImage(milestoneId);
    if (result.success) {
      window.location.reload();
    } else {
      alert(result.error);
      setImageBusyId(null);
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={CURATED_MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
      />

      <input
        ref={startPhotoInputRef}
        type="file"
        accept={CURATED_MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleStartPhoto(file);
          e.target.value = "";
        }}
      />

      <input
        ref={extraInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (extraMilestoneId.current) void handleAddPhotos(extraMilestoneId.current, files);
        }}
      />

      <PhotoTimelineImport
        eventId={eventId}
        existingMilestones={milestones}
        actions={actions}
        uploadMedia={uploadMedia}
        uploadToMilestone={uploadToMilestone}
      />

      <div className="grid gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:grid-cols-3">
        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
          {startPhoto ? (
            <div className="flex w-full items-center gap-3 rounded-lg border border-gold-500/30 bg-white p-2">
              {startPhoto.file.type.startsWith("video/") || isVideoMedia(startPhoto.file.name) ? (
                <video src={startPhoto.preview} muted playsInline className="h-12 w-12 shrink-0 rounded object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={startPhoto.preview} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1 text-xs text-navy-700/70">
                <p className="font-medium text-navy-950">This photo will be attached to the new milestone.</p>
                <p className="truncate">
                  {describeFacts(startPhoto.facts) ??
                    "No date or location found in this photo — fill in the fields yourself."}
                </p>
              </div>
              <button
                type="button"
                onClick={clearStartPhoto}
                aria-label="Remove photo"
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={readingPhoto || busy}
                onClick={() => startPhotoInputRef.current?.click()}
              >
                {readingPhoto ? <Loader2 className="animate-spin" size={13} /> : <Camera size={13} />}
                Start from a photo
              </Button>
              {!readingPhoto ? (
                <>
                  <GooglePhotosButton
                    variant="compact"
                    max={1}
                    onFiles={(files) => files[0] && void handleStartPhoto(files[0])}
                  />
                  <GoogleDriveButton
                    variant="compact"
                    max={1}
                    includeVideos
                    onFiles={(files) => files[0] && void handleStartPhoto(files[0])}
                  />
                </>
              ) : null}
              <span className="text-xs text-navy-700/50">
                We&rsquo;ll fill in when and where it was taken, if the photo knows.
              </span>
            </>
          )}
        </div>
        <input
          placeholder="Period (e.g. Early Years)"
          value={form.period}
          onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
          className={inputClasses}
        />
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={inputClasses}
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputClasses}
        />
        <div className="sm:col-span-3">
          <Button onClick={handleAdd} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
            Add Milestone
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-navy-700/50">
        Start from a photo, or add the milestone first and attach a photo or MP4 video (up to 300MB) below — photos also
        become selectable slides in the Slideshow Video composer.
      </p>
      <PhotoMetadataTip pickHint="tap “Start from a photo”, then choose Browse / Files / Drive" />

      <div className="mt-6 space-y-3">
        {milestones.map((m, index) => (
          <div key={m.id} className="flex items-start gap-3 rounded-xl border border-navy-950/10 bg-white p-4">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={index === 0 || busy}
                onClick={() => move(index, -1)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                disabled={index === milestones.length - 1 || busy}
                onClick={() => move(index, 1)}
                className="tap-target flex items-center justify-center text-navy-700/50 hover:text-gold-600 disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </button>
            </div>

            {m.imageUrl ? (
              isVideoMedia(m.imageUrl) ? (
                <video
                  src={m.imageUrl}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={m.title}
                  className="w-40 shrink-0 rounded-lg bg-black"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.imageUrl} alt={m.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              )
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-navy-950/15 text-navy-700/30">
                <ImagePlus size={18} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-gold-600">{m.period}</p>
              <p className="font-display text-lg text-navy-950">{m.title}</p>
              <p className="text-sm text-navy-700/70">{m.description}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={imageBusyId === m.id}
                  onClick={() => triggerImageUpload(m.id)}
                >
                  {imageBusyId === m.id ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                  {m.imageUrl ? "Replace media" : "Add photo or video"}
                </Button>
                {imageBusyId !== m.id ? (
                  <>
                    <GooglePhotosButton
                      variant="compact"
                      max={1}
                      onFiles={(files) => {
                        pendingMilestoneId.current = m.id;
                        if (files[0]) void handleImageFile(files[0]);
                      }}
                    />
                    <GoogleDriveButton
                      variant="compact"
                      max={1}
                      includeVideos
                      onFiles={(files) => {
                        pendingMilestoneId.current = m.id;
                        if (files[0]) void handleImageFile(files[0]);
                      }}
                    />
                  </>
                ) : null}
                {m.imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={imageBusyId === m.id}
                    onClick={() => handleRemoveImage(m.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X size={13} /> Remove photo
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={extraBusy !== null}
                  onClick={() => {
                    extraMilestoneId.current = m.id;
                    extraInputRef.current?.click();
                  }}
                >
                  {extraBusy?.id === m.id ? <Loader2 className="animate-spin" size={13} /> : <Images size={13} />}
                  {extraBusy?.id === m.id ? extraBusy.message : "Add more photos"}
                </Button>
              </div>
              {m.photos && m.photos.length > 0 ? (
                <div className="mt-2">
                  <p className="mb-1 text-xs text-navy-700/50">
                    {m.photos.length} more photo{m.photos.length === 1 ? "" : "s"} — shown with the main photo on your Timeline
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {m.photos.map((photo) => (
                      <li key={photo.id} className="group relative h-12 w-12">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" loading="lazy" className="h-full w-full rounded object-cover" />
                        <button
                          type="button"
                          onClick={() => void handleRemoveExtra(photo.id)}
                          aria-label="Remove this photo"
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-navy-700 shadow ring-1 ring-navy-950/10 hover:text-red-600"
                        >
                          <X size={11} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busyId === m.id}
              onClick={() => handleDelete(m.id)}
              className="tap-target flex items-center justify-center text-navy-700/50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {milestones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy-950/15 py-16 text-center text-sm text-navy-700/50">
            No milestones yet — add the first one above.
          </p>
        ) : null}
      </div>
    </div>
  );
}
