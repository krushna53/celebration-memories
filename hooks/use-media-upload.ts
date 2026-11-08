"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { GooglePhotosVideo } from "@/features/uploads/components/google-photos-button";
import { readRecovery, recoveryKey, writeRecovery } from "@/lib/upload-recovery";
import { compressImage } from "@/lib/image-compression";
import { confirmUpload, deleteUploadAction, logCaptureStartedAction, requestUploadUrl } from "@/features/uploads/actions";

export interface UploadItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  phase?: string;
  /** Once bytes arrive, retry only confirmation, never upload a second copy. */
  uploadedPath?: string;
  caption: string;
  /** Set once the upload finishes (the photos/videos/audio row's id) — lets remove() delete it server-side too, not just drop it from this local queue. Undefined until then. */
  mediaId?: string;
  /** Set for a video picked in Google Photos: `file` is only its thumbnail; the video streams Google → Storage on upload. */
  remote?: { sourceUrl: string; googleToken: string; name: string };
}

/**
 * Orchestrates the guest upload flow for one media kind (photo/video/
 * audio): compress (photos only) -> ask the server for a signed Storage
 * URL -> PUT the file directly to Storage from the browser -> tell the
 * server to record the row. Nothing but the signed PUT touches Supabase
 * directly from the client; everything else is a Server Action.
 */
export function useMediaUpload(token: string, kind: "photo" | "video" | "audio") {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const active = useRef(new Set<string>());
  const batchActive = useRef(false);
  const scope = `${token}:${kind}`;
  const [readyScope, setReadyScope] = useState<string | null>(null);
  const ready = readyScope === scope;
  const [recoveryAvailable, setRecoveryAvailable] = useState(true);
  const persistence = useRef(Promise.resolve());
  const lastSnapshot = useRef("");

  useEffect(() => {
    let cancelled = false;
    setReadyScope(null);
    setItems([]);
    setRecoveryAvailable(true);
    recoveryKey(token, kind).then(readRecovery).then((saved) => {
      if (!cancelled) setItems((current) => [...saved.map((item): UploadItem => ({
        ...item, file: new File([item.file], item.name, { type: item.file.type, lastModified: item.lastModified }),
        status: "pending", phase: "Recovered on this device — tap Upload to continue.",
      })), ...current]);
    }).catch(() => { if (!cancelled) setRecoveryAvailable(false); }).finally(() => { if (!cancelled) setReadyScope(scope); });
    return () => { cancelled = true; };
  }, [token, kind, scope]);

  useEffect(() => {
    if (!ready) return;
    const saved = items.filter((item) => item.status !== "done" && !item.remote).map((item) => ({
      id: item.id, file: item.file, name: item.file.name, lastModified: item.file.lastModified,
      caption: item.caption, uploadedPath: item.uploadedPath,
    }));
    const snapshot = JSON.stringify([scope, saved.map(({ id, name, caption, uploadedPath }) => ({ id, name, caption, uploadedPath }))]);
    if (snapshot === lastSnapshot.current) return;
    lastSnapshot.current = snapshot;
    // Serialize writes so an older snapshot cannot overwrite a completed queue.
    persistence.current = persistence.current.then(async () => writeRecovery(await recoveryKey(token, kind), saved))
      .catch(() => setRecoveryAvailable(false));
  }, [items, ready, token, kind, scope]);

  useEffect(() => {
    if (!items.some((item) => item.status !== "done")) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [items]);


  /** Returns the newly-created items' ids, in order — lets a caller (e.g. the recorder UI's "Record again") target the specific item it just added without guessing at array position. */
  const addFiles = useCallback((files: FileList | File[]): string[] => {
    const next: UploadItem[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "pending",
      caption: "",
    }));
    setItems((prev) => [...prev, ...next]);

    // Fire-and-forget: signals "guest has an unfinished video/audio" for
    // the reminder system — see logCaptureStartedAction's doc comment.
    // Not awaited (upload queueing must stay instant), and deliberately
    // scoped to video/audio only.
    if (kind === "video" || kind === "audio") {
      logCaptureStartedAction(token, kind).catch(() => {
        // Best-effort — a failed log shouldn't block the guest from
        // continuing to use the upload queue.
      });
    }

    return next.map((it) => it.id);
  }, [kind, token]);

  /** Google Photos videos (see GooglePhotosButton) — queued with a thumbnail; uploaded by the google-photos-transfer Edge Function. */
  const addRemoteVideos = useCallback((videos: GooglePhotosVideo[]): string[] => {
    const next: UploadItem[] = videos.map((v) => ({
      id: `gphotos-${Math.random().toString(36).slice(2)}`,
      file: v.thumbnail,
      status: "pending",
      caption: "",
      remote: { sourceUrl: v.sourceUrl, googleToken: v.googleToken, name: v.name },
    }));
    setItems((prev) => [...prev, ...next]);
    return next.map((it) => it.id);
  }, []);

  const setCaption = useCallback((id: string, caption: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, caption } : it)));
  }, []);

  /**
   * Drops an item from the queue — and, if it already finished
   * uploading, deletes the underlying photo/video/audio row (and its
   * Storage object) too, via deleteUploadAction. Removes it from local
   * state immediately either way so the UI feels instant; the server
   * delete for an already-uploaded item happens in the background
   * (best-effort — see deleteOwnMediaUpload's doc comment for why a
   * failure here doesn't try to put the item back).
   */
  const remove = useCallback(
    (id: string) => {
      if (active.current.has(id)) return;
      const item = itemsRef.current.find((it) => it.id === id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (item?.status === "done" && item.mediaId) {
        deleteUploadAction(token, kind, item.mediaId).catch((err) => {
          console.error("Failed to delete uploaded memory:", err);
        });
      }
    },
    [token, kind],
  );

  const performUpload = useCallback(
    async (initial: UploadItem) => {
      if (active.current.has(initial.id) || initial.status === "done") return;
      active.current.add(initial.id);
      let item = initial;
      let signed: Awaited<ReturnType<typeof requestUploadUrl>> | undefined;
      let file: File | undefined;
      const update = (patch: Partial<UploadItem>) => {
        item = { ...item, ...patch };
        setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, ...patch } : it));
      };
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            update({ status: "uploading", error: undefined, phase: attempt ? "Connection interrupted — retrying…" : "Preparing your memory…" });
            if (!navigator.onLine) throw new TypeError("You’re offline. Reconnect, then tap Retry.");
            if (!item.uploadedPath) {
              if (!file) file = kind === "photo" ? await compressImage(item.file) : item.file;
              if (!signed) signed = await requestUploadUrl(token, kind, item.remote?.name ?? file.name, item.remote ? "video/mp4" : file.type, item.remote ? 1 : file.size);
              if (!signed.success) throw new Error(signed.error);
              const { bucket, path, token: uploadToken } = signed.data;
              update({ phase: "Uploading your memory…" });
              if (item.remote) {
                const { data, error } = await supabaseBrowser().functions.invoke<{ ok?: boolean; error?: string }>("google-photos-transfer", {
                  body: { sourceUrl: item.remote.sourceUrl, googleToken: item.remote.googleToken, bucket, path, uploadToken },
                });
                if (error || !data?.ok) throw new Error(data?.error ?? "Couldn’t copy the video from Google Photos. Please try again.");
              } else {
                const { error } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, uploadToken, file);
                // A prior attempt may have arrived even though its response was lost.
                // Confirmation verifies ownership and that the object exists.
                if (error && !("statusCode" in error && ["409", "400"].includes(String(error.statusCode)) && /already exists|duplicate/i.test(error.message))) {
                  const retryable = !("statusCode" in error) || Number(error.statusCode) >= 500 || Number(error.statusCode) === 429;
                  if (retryable) throw new TypeError(error.message);
                  throw new Error(error.message);
                }
              }
              update({ uploadedPath: path });
            }
            update({ phase: "Saving your memory…" });
            const confirmed = await confirmUpload(token, kind, item.uploadedPath!, item.caption);
            if (!confirmed.success) throw new TypeError(confirmed.error);
            update({ status: "done", mediaId: confirmed.data.id, phase: undefined });
            return;
          } catch (error) {
            if (!(error instanceof TypeError) || attempt === 2 || !navigator.onLine) throw error;
            update({ phase: `Connection interrupted — retrying (${attempt + 1}/2)…` });
            await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
          }
        }
      } catch (err) {
        update({ status: "error", phase: undefined, error: err instanceof Error ? err.message : "Upload failed. Please retry." });
      } finally {
        active.current.delete(initial.id);
      }
    },
    [kind, token],
  );

  const uploadOne = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((it) => it.id === id);
      if (ready && item && item.status !== "done") return performUpload(item);
    },
    [ready, performUpload],
  );

  const uploadAll = useCallback(async () => {
    if (!ready || batchActive.current) return;
    batchActive.current = true;
    try {
      const pending = itemsRef.current.filter((it) => it.status === "pending" || it.status === "error");
      for (const queued of pending) {
        const item = itemsRef.current.find((it) => it.id === queued.id);
        if (!item) continue;
        // Sequential uploads avoid saturating bandwidth on mobile networks.
        await performUpload(item);
      }
    } finally { batchActive.current = false; }
  }, [ready, performUpload]);

  return { items, ready, recoveryAvailable, addFiles, addRemoteVideos, setCaption, remove, uploadOne, uploadAll };
}
