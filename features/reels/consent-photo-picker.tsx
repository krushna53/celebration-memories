"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image-compression";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { requestReelSelfieUploadAction, saveReelSelfieAction } from "@/features/reels/actions";
import {
  requestReelFaceUploadAction,
  saveHonoreeReelPhotoAction,
  saveInviteeReelPhotoAction,
} from "@/features/admin/reels/actions";

/**
 * Picks, previews and saves a face photo for Guest Reels — with consent.
 * Nothing is uploaded until the consent box is ticked. Used for:
 *  - a guest's own selfie (RSVP form, after-event invite page) → target "guest"
 *  - the guest-of-honour photo (Event Settings, /admin/reels) → "honoree"
 *  - a host adding a photo for a guest who agreed (/admin/reels) → "invitee"
 * Each target calls its own token- or admin-gated Server Actions.
 */
export type ConsentPhotoTarget =
  | { kind: "guest"; token: string }
  | { kind: "honoree"; eventId: string }
  | { kind: "invitee"; eventId: string; inviteeId: string };

interface ConsentPhotoPickerProps {
  target: ConsentPhotoTarget;
  currentPhotoUrl: string | null;
  consentLabel: ReactNode;
  /** Shown above the buttons when there's no photo yet. */
  prompt?: ReactNode;
  compact?: boolean;
  onSaved?: (hasPhoto: boolean) => void;
}

type SignedResult =
  | { success: true; data: { bucket: string; path: string; token: string } }
  | { success: false; error: string };

function requestUpload(target: ConsentPhotoTarget, file: File): Promise<SignedResult> {
  switch (target.kind) {
    case "guest":
      return requestReelSelfieUploadAction(target.token, file.name, file.type, file.size);
    case "honoree":
      return requestReelFaceUploadAction(target.eventId, "honoree", file.name, file.type, file.size);
    case "invitee":
      return requestReelFaceUploadAction(target.eventId, target.inviteeId, file.name, file.type, file.size);
  }
}

function save(target: ConsentPhotoTarget, path: string | null, consent: boolean) {
  switch (target.kind) {
    case "guest":
      return saveReelSelfieAction(target.token, path, consent);
    case "honoree":
      return saveHonoreeReelPhotoAction(target.eventId, path, consent);
    case "invitee":
      return saveInviteeReelPhotoAction(target.eventId, target.inviteeId, path, consent);
  }
}

export function ConsentPhotoPicker({ target, currentPhotoUrl, consentLabel, prompt, compact, onSaved }: ConsentPhotoPickerProps) {
  const router = useRouter();
  const consentId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(currentPhotoUrl);

  function pick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    if (pending) URL.revokeObjectURL(pending.preview);
    setPending({ file, preview: URL.createObjectURL(file) });
  }

  async function upload() {
    if (!pending) return;
    if (!consent) {
      setError("Please tick the box to agree first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Faces only need modest resolution; this also converts iPhone HEIC to JPEG.
      const file = await compressImage(pending.file, { maxDimension: 1200, quality: 0.85 });
      const signed = await requestUpload(target, file);
      if (!signed.success) throw new Error(signed.error);
      const { bucket, path, token } = signed.data;
      const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(uploadError.message);
      const saved = await save(target, path, true);
      if (!saved.success) throw new Error(saved.error);
      setSavedUrl(pending.preview);
      setPending(null);
      setConsent(false);
      onSaved?.(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this photo? It will no longer be used to find anyone in the event photos.")) return;
    setBusy(true);
    setError(null);
    const result = await save(target, null, false);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSavedUrl(null);
    onSaved?.(false);
    router.refresh();
  }

  const thumb = compact ? "h-16 w-16" : "h-24 w-24";

  return (
    <div className="grid gap-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files)}
      />

      {pending ? (
        <div className="grid gap-3 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={pending.preview} alt="Your chosen photo" className={cn(thumb, "rounded-full object-cover ring-2 ring-gold-500")} />
            <button type="button" className="text-xs text-navy-700/70 underline" onClick={() => setPending(null)} disabled={busy}>
              Choose a different photo
            </button>
          </div>
          <label htmlFor={consentId} className="flex items-start gap-2.5 text-sm text-navy-700/85">
            <input
              id={consentId}
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
            />
            <span>{consentLabel}</span>
          </label>
          <Button type="button" size="sm" onClick={upload} disabled={busy || !consent} className="justify-self-start">
            {busy ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
            {busy ? "Saving..." : "Agree & save photo"}
          </Button>
        </div>
      ) : savedUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed /media link */}
          <img src={savedUrl} alt="Saved photo" className={cn(thumb, "rounded-full object-cover ring-2 ring-gold-500/60")} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()} disabled={busy}>
              <ImagePlus size={14} /> Change
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />} Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {prompt}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
              <Camera size={14} /> Take a selfie
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
              <ImagePlus size={14} /> Choose a photo
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
