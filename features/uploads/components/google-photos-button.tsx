"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { loadGis, requestGoogleToken } from "@/lib/google-identity";
import { rememberPhotoTakenAt } from "@/lib/photo-metadata";

/**
 * "Google Photos" import (Google Photos Picker API). Flow:
 *   1. Tap → Google sign-in popup (Google Identity Services token client,
 *      picker-only scope; no EveryMoment account involved).
 *   2. We start a picking session and show "Open Google Photos" — a
 *      second tap, because browsers block popups opened after async work.
 *   3. The guest browses/searches their own library & albums in Google's
 *      picker and taps Done; we poll until Google reports the picks.
 *   4. Each picked photo is fetched via our /api/google-photos/media proxy
 *      and handed to `onFiles` — the same path as "Choose from Gallery".
 * The access token stays in memory for this import only.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_PHOTOS_CLIENT_ID;
const SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

export const GOOGLE_PHOTOS_ENABLED = Boolean(CLIENT_ID);

/** A video picked in Google Photos, not yet copied: the queue shows `thumbnail`; the upload streams `sourceUrl` Google → Storage. */
export interface GooglePhotosVideo {
  name: string;
  thumbnail: File;
  sourceUrl: string;
  googleToken: string;
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

type Stage =
  | { kind: "idle" }
  | { kind: "signing-in" }
  | { kind: "ready"; pickerUri: string }
  | { kind: "picking"; pickerUri: string }
  | { kind: "importing"; done: number; total: number };

export function GooglePhotosButton({
  onFiles,
  onVideos,
  className,
  label = "Google Photos",
  max = 30,
  variant = "block",
}: {
  /** Photos mode — picked photos arrive as ready-to-upload JPEG files. */
  onFiles?: (files: File[]) => void;
  /** Videos mode — picked videos arrive as thumbnails + a source to stream from on upload. */
  onVideos?: (videos: GooglePhotosVideo[]) => void;
  className?: string;
  label?: string;
  /** Most items Google's picker lets the person choose (1 for single-photo fields like a cover image). Max 30. */
  max?: number;
  /** "block" = full-width tile next to other upload tiles; "compact" = small pill beside an existing upload button. */
  variant?: "block" | "compact";
}) {
  const want = onVideos ? "VIDEO" : "PHOTO";
  const compact = variant === "compact";
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const session = useRef<{ token: string; id: string; pollMs: number } | null>(null);
  const cancelled = useRef(false);

  // Warm the Google script so the first tap opens sign-in instantly (a late load can trip popup blockers).
  useEffect(() => {
    if (CLIENT_ID) loadGis().catch(() => {});
    return () => {
      cancelled.current = true;
    };
  }, []);

  if (!CLIENT_ID) return null;

  function reset(note: string | null = null) {
    session.current = null;
    setStage({ kind: "idle" });
    setMessage(note);
  }

  async function connect() {
    setMessage(null);
    try {
      setStage({ kind: "signing-in" });
      const token = await requestGoogleToken(CLIENT_ID!, SCOPE);
      const s = await api<{ id: string; pickerUri: string; pollIntervalMs: number }>(token, "/api/google-photos/session", { method: "POST", body: JSON.stringify({ max }) });
      session.current = { token, id: s.id, pollMs: s.pollIntervalMs };
      setStage({ kind: "ready", pickerUri: s.pickerUri });
    } catch (err) {
      reset(err instanceof Error ? err.message : "Couldn't connect to Google Photos.");
    }
  }

  // Must run straight from the tap so the new tab isn't treated as a popup.
  function openPicker(pickerUri: string) {
    window.open(`${pickerUri}/autoclose`, "_blank");
    setStage({ kind: "picking", pickerUri });
    void waitForPicks();
  }

  async function waitForPicks() {
    const s = session.current;
    if (!s) return;
    const deadline = Date.now() + 20 * 60 * 1000;
    try {
      while (Date.now() < deadline) {
        if (cancelled.current || session.current !== s) return;
        const { done } = await api<{ done: boolean }>(s.token, `/api/google-photos/session?id=${encodeURIComponent(s.id)}`);
        if (done) return await importPicks(s);
        await new Promise((r) => setTimeout(r, s.pollMs));
      }
      reset("Google Photos timed out — please try again.");
    } catch (err) {
      reset(err instanceof Error ? err.message : "Couldn't reach Google Photos.");
    }
  }

  async function importPicks(s: { token: string; id: string }) {
    const { items } = await api<{ items: { id: string; type: string; baseUrl: string; filename: string | null; createTime: string | null }[] }>(
      s.token,
      `/api/google-photos/items?sessionId=${encodeURIComponent(s.id)}`,
    );
    const picked = items.filter((i) => i.type === want);
    const skipped = items.length - picked.length;
    setStage({ kind: "importing", done: 0, total: picked.length });

    const files: File[] = [];
    const videos: GooglePhotosVideo[] = [];
    let failed = 0;
    for (const [i, item] of picked.entries()) {
      try {
        const res = await fetch("/api/google-photos/media", {
          method: "POST",
          headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl: item.baseUrl, thumbnail: want === "VIDEO" }),
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const base = (item.filename ?? `google-${want === "VIDEO" ? "video" : "photo"}-${i + 1}`).replace(/\.[^.]+$/, "");
        const image = new File([blob], `${base}.jpg`, { type: blob.type || "image/jpeg" });
        // The resized download has no EXIF — carry Google's capture time over for Timeline/Gallery pre-fill.
        if (item.createTime) rememberPhotoTakenAt(image, item.createTime);
        if (want === "VIDEO") {
          // =dv is Google's download-video form (an MP4 transcode) — streamed server-side on upload.
          videos.push({ name: `${base}.mp4`, thumbnail: image, sourceUrl: `${item.baseUrl}=dv`, googleToken: s.token });
        } else {
          files.push(image);
        }
      } catch {
        failed++;
      }
      setStage({ kind: "importing", done: i + 1, total: picked.length });
    }

    // Videos still need the session's token to stream on upload, so only photo imports close the session now.
    if (want === "PHOTO") {
      void fetch(`/api/google-photos/session?id=${encodeURIComponent(s.id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${s.token}` } });
    }
    if (files.length) onFiles?.(files);
    if (videos.length) onVideos?.(videos);
    const added = files.length + videos.length;
    const noun = want === "VIDEO" ? "video" : "photo";
    const other = want === "VIDEO" ? "photo" : "video";
    const notes = [
      added ? `Added ${added} ${noun}${added === 1 ? "" : "s"} from Google Photos${want === "VIDEO" ? " — tap Upload to copy them" : ""}.` : `No ${noun}s were added.`,
      skipped ? `${skipped} ${other}${skipped === 1 ? "" : "s"} skipped — add ${other}s from the ${other} option.` : "",
      failed ? `${failed} couldn't be loaded.` : "",
    ].filter(Boolean);
    reset(notes.join(" "));
  }

  const busy = stage.kind === "signing-in" || stage.kind === "importing";

  return (
    <div className={className}>
      {stage.kind === "ready" || stage.kind === "picking" ? (
        <div
          className={
            compact
              ? "flex flex-col items-start gap-1.5 rounded-lg border border-gold-500/40 bg-gold-500/5 px-3 py-2"
              : "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gold-500/40 bg-gold-500/5 px-3 py-4 text-center"
          }
        >
          <button
            type="button"
            onClick={() => openPicker(stage.pickerUri)}
            className="inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-4 py-2 text-sm font-medium text-ivory-50"
          >
            <ExternalLink size={15} /> {stage.kind === "picking" ? "Open Google Photos again" : "Open Google Photos"}
          </button>
          <p className="text-xs text-navy-700/70">
            {stage.kind === "picking"
              ? "Pick photos (search and albums work there), tap Done, then come back here…"
              : "Browse or search your photos and albums, then tap Done."}
          </p>
          {stage.kind === "picking" ? <Loader2 size={16} className="animate-spin text-gold-600" /> : null}
          <button type="button" onClick={() => reset()} className="text-xs text-navy-700/60 underline">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={connect}
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
              {stage.kind === "importing" ? `Importing ${stage.done} of ${stage.total}…` : "Connecting to Google…"}
            </>
          ) : (
            <>
              <GooglePhotosMark size={compact ? 14 : 20} /> {label}
            </>
          )}
        </button>
      )}
      {message ? <p className={compact ? "mt-1 text-xs text-navy-700/80" : "mt-2 text-center text-xs text-navy-700/80"}>{message}</p> : null}
    </div>
  );
}

/** Simple four-petal mark in Google's colours — not Google's logo, just a recognisable hint. */
function GooglePhotosMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12V2a5 5 0 0 1 5 5v5z" fill="#EA4335" />
      <path d="M12 12h10a5 5 0 0 1-5 5h-5z" fill="#4285F4" />
      <path d="M12 12v10a5 5 0 0 1-5-5v-5z" fill="#34A853" />
      <path d="M12 12H2a5 5 0 0 1 5-5h5z" fill="#FBBC05" />
    </svg>
  );
}
