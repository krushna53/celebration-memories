"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { loadGis, loadGooglePicker, requestGoogleToken, type PickerDocument } from "@/lib/google-identity";

/**
 * "Google Drive" import (Google Picker API + Drive API). Flow:
 *   1. Tap → Google sign-in popup with the `drive.file` scope — the
 *      narrowest Drive permission: the app can only open files the person
 *      explicitly picks, nothing else in their Drive.
 *   2. Google's own Drive picker opens over the page (My Drive, Shared
 *      with me, search, folders).
 *   3. Each picked file is downloaded straight from Drive in the browser
 *      and handed to `onFiles` — the same path as "Choose from Gallery",
 *      so it's compressed, validated and moderated like any upload.
 *
 * Unlike Google Photos imports, Drive gives back the ORIGINAL file, so a
 * photo's EXIF date and GPS survive — which is what lets Timeline and
 * Gallery pre-fill "when and where" (lib/photo-metadata.ts).
 *
 * Needs three public values (all safe in the browser): the same OAuth
 * client id Google Photos uses, a browser API key restricted to the
 * Picker API, and the Google Cloud project number. Renders nothing until
 * all three are set — see README's Google Drive section.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER;
const SCOPE = "https://www.googleapis.com/auth/drive.file";

export const GOOGLE_DRIVE_ENABLED = Boolean(CLIENT_ID && API_KEY && APP_ID);

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
/** Files are downloaded into the browser before upload — beyond this a phone can run out of memory, so bigger files are skipped. */
const MAX_BYTES = 300 * 1024 * 1024;

type Stage = { kind: "idle" } | { kind: "signing-in" } | { kind: "picking" } | { kind: "importing"; done: number; total: number };

export function GoogleDriveButton({
  onFiles,
  includeVideos = false,
  className,
  label = "Google Drive",
  max = 30,
  variant = "block",
}: {
  onFiles: (files: File[]) => void;
  /** Also allow MP4/MOV videos (only where the upload accepts them). */
  includeVideos?: boolean;
  className?: string;
  label?: string;
  /** Most files the picker lets the person choose (1 for single-photo fields). */
  max?: number;
  /** "block" = full-width tile next to other upload tiles; "compact" = small pill beside an existing upload button. */
  variant?: "block" | "compact";
}) {
  const compact = variant === "compact";
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [message, setMessage] = useState<string | null>(null);

  // Warm both Google scripts so the first tap opens sign-in instantly (a late load can trip popup blockers).
  useEffect(() => {
    if (!GOOGLE_DRIVE_ENABLED) return;
    loadGis().catch(() => {});
    loadGooglePicker().catch(() => {});
  }, []);

  if (!GOOGLE_DRIVE_ENABLED) return null;

  const mimeTypes = includeVideos ? [...PHOTO_TYPES, ...VIDEO_TYPES] : PHOTO_TYPES;

  async function start() {
    setMessage(null);
    try {
      setStage({ kind: "signing-in" });
      const [token, picker] = await Promise.all([requestGoogleToken(CLIENT_ID!, SCOPE), loadGooglePicker()]);
      setStage({ kind: "picking" });

      const docs = await new Promise<PickerDocument[]>((resolve) => {
        const view = new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(mimeTypes.join(",")).setIncludeFolders(true);
        let builder = new picker.PickerBuilder()
          .addView(view)
          .enableFeature(picker.Feature.SUPPORT_DRIVES)
          .setOAuthToken(token)
          .setDeveloperKey(API_KEY!)
          .setAppId(APP_ID!)
          .setTitle(includeVideos ? "Choose photos or videos" : "Choose photos")
          .setCallback((response) => {
            if (response.action === picker.Action.PICKED) resolve(response.docs ?? []);
            else if (response.action === picker.Action.CANCEL) resolve([]);
          });
        if (max > 1) builder = builder.enableFeature(picker.Feature.MULTISELECT_ENABLED).setMaxItems(max);
        builder.build().setVisible(true);
      });

      if (docs.length === 0) {
        setStage({ kind: "idle" });
        return;
      }
      await importDocs(token, docs.slice(0, max));
    } catch (err) {
      setStage({ kind: "idle" });
      setMessage(err instanceof Error ? err.message : "Couldn't connect to Google Drive.");
    }
  }

  async function importDocs(token: string, docs: PickerDocument[]) {
    setStage({ kind: "importing", done: 0, total: docs.length });
    const files: File[] = [];
    let failed = 0;
    let skipped = 0;
    let tooLarge = 0;

    for (const [i, doc] of docs.entries()) {
      try {
        if (!mimeTypes.includes(doc.mimeType)) {
          skipped++;
          continue;
        }
        if (Number(doc.sizeBytes ?? 0) > MAX_BYTES) {
          tooLarge++;
          continue;
        }
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        files.push(new File([blob], doc.name, { type: doc.mimeType }));
      } catch {
        failed++;
      } finally {
        setStage({ kind: "importing", done: i + 1, total: docs.length });
      }
    }

    if (files.length) onFiles(files);
    const noun = includeVideos ? "file" : "photo";
    setMessage(
      [
        files.length ? `Added ${files.length} ${noun}${files.length === 1 ? "" : "s"} from Google Drive.` : `No ${noun}s were added.`,
        skipped ? `${skipped} skipped — only ${includeVideos ? "photos and MP4/MOV videos" : "photos"} can be added here.` : "",
        tooLarge ? `${tooLarge} over 300MB — upload ${tooLarge === 1 ? "it" : "them"} from your device instead.` : "",
        failed ? `${failed} couldn't be downloaded.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    setStage({ kind: "idle" });
  }

  const busy = stage.kind !== "idle";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs font-medium text-navy-950 transition-luxury duration-200 hover:border-gold-500/60 disabled:opacity-70"
            : "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold-500/30 bg-gold-500/5 px-3 py-4 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:border-gold-500/60 hover:bg-gold-500/10 disabled:opacity-70"
        }
      >
        {busy ? (
          <>
            <Loader2 size={compact ? 13 : 18} className="animate-spin text-gold-600" />
            {stage.kind === "importing"
              ? `Importing ${stage.done} of ${stage.total}…`
              : stage.kind === "picking"
                ? "Choose in Google Drive…"
                : "Connecting to Google…"}
          </>
        ) : (
          <>
            <GoogleDriveMark size={compact ? 14 : 20} /> {label}
          </>
        )}
      </button>
      {message ? <p className={compact ? "mt-1 text-xs text-navy-700/80" : "mt-2 text-center text-xs text-navy-700/80"}>{message}</p> : null}
    </div>
  );
}

/** Simple three-colour triangle in Google's colours — not Google's logo, just a recognisable hint. */
function GoogleDriveMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 3h7.6l7 12h-7.6z" fill="#FBBC05" />
      <path d="M1.2 15 5 21.5 12 9.4 8.2 3z" fill="#34A853" />
      <path d="M5 21.5h14l3.8-6.5H8.8z" fill="#4285F4" />
    </svg>
  );
}
