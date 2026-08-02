"use client";

import { useCallback, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import { confirmUpload, deleteUploadAction, requestUploadUrl } from "@/features/uploads/actions";

export interface UploadItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  caption: string;
  /** Set once the upload finishes (the photos/videos/audio row's id) — lets remove() delete it server-side too, not just drop it from this local queue. Undefined until then. */
  mediaId?: string;
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

  /** Returns the newly-created items' ids, in order — lets a caller (e.g. the recorder UI's "Record again") target the specific item it just added without guessing at array position. */
  const addFiles = useCallback((files: FileList | File[]): string[] => {
    const next: UploadItem[] = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "pending",
      caption: "",
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
      const item = items.find((it) => it.id === id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (item?.status === "done" && item.mediaId) {
        deleteUploadAction(token, kind, item.mediaId).catch((err) => {
          console.error("Failed to delete uploaded memory:", err);
        });
      }
    },
    [items, token, kind],
  );

  const performUpload = useCallback(
    async (item: UploadItem) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "uploading", error: undefined } : it,
        ),
      );

      try {
        const file = kind === "photo" ? await compressImage(item.file) : item.file;

        const signed = await requestUploadUrl(token, kind, file.name, file.type, file.size);
        if (!signed.success) {
          throw new Error(signed.error);
        }

        const { bucket, path, token: uploadToken } = signed.data;
        const { error: uploadError } = await supabaseBrowser()
          .storage.from(bucket)
          .uploadToSignedUrl(path, uploadToken, file);

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const confirmed = await confirmUpload(token, kind, path, item.caption);
        if (!confirmed.success) {
          throw new Error(confirmed.error);
        }

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "done", mediaId: confirmed.data.id } : it,
          ),
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed.",
                }
              : it,
          ),
        );
      }
    },
    [kind, token],
  );

  const uploadOne = useCallback(
    (id: string) => {
      const item = items.find((it) => it.id === id);
      if (item) return performUpload(item);
    },
    [items, performUpload],
  );

  const uploadAll = useCallback(async () => {
    const pending = items.filter((it) => it.status === "pending" || it.status === "error");
    for (const item of pending) {
      // Sequential on purpose — keeps mobile uploads on flaky networks
      // predictable and avoids saturating bandwidth with large videos.
      await performUpload(item);
    }
  }, [items, performUpload]);

  return { items, addFiles, setCaption, remove, uploadOne, uploadAll };
}
