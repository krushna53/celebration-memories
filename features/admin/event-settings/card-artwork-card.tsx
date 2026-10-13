"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, ImageIcon, ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  confirmCardArtworkUploadAction,
  extractCardArtworkAction,
  removeCardArtworkAction,
  requestCardArtworkUploadAction,
} from "@/features/admin/templates/card-template-actions";

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Event Settings card for the banner image shown under the title at the top
 * of the event page (services/card-artwork.ts). Hosts can upload their own,
 * or have it cropped off their invitation card, and preview it before and
 * after — the preview here matches how it sits under the title.
 */
export function CardArtworkCard({
  eventId,
  eventSlug,
  artworkUrl,
  hasCard,
}: {
  eventId: string;
  eventSlug: string;
  artworkUrl: string | null;
  hasCard: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [current, setCurrent] = useState(artworkUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setMessage(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ ok: false, text: "Use a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ ok: false, text: "That image is too large." });
      return;
    }
    // Instant local preview while it uploads.
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setUploading(true);
    try {
      const prep = await requestCardArtworkUploadAction(eventId, file.type, file.size);
      if (!prep.success) throw new Error(prep.error);
      const put = await fetch(prep.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("The upload didn't go through — please try again.");
      const done = await confirmCardArtworkUploadAction(eventId, prep.path);
      if (!done.success) throw new Error(done.error);
      setCurrent(done.url);
      setMessage({ ok: true, text: "Image saved — it now shows under your title." });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
      setLocalPreview(null);
      URL.revokeObjectURL(preview);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function run(action: () => Promise<{ success: true } | { success: false; error: string }>, ok: string, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        after?.();
        setMessage({ ok: true, text: ok });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  const shown = localPreview ?? current;
  const busy = pending || uploading;

  return (
    <section className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-navy-950">Banner image</h2>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/65">
        An image shown right under your event&rsquo;s title at the top of the page — like the illustration on your
        invitation card. Upload your own, or let us cut it out of your invitation card.
      </p>

      <div className="mt-4 rounded-xl border border-dashed border-navy-950/15 bg-ivory-50 p-4 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-navy-700/50">Preview</p>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Banner image preview" className={`mx-auto mt-3 h-auto max-h-56 w-auto max-w-full rounded-xl object-contain ${uploading ? "opacity-60" : ""}`} />
        ) : (
          <p className="mt-3 text-sm text-navy-700/50">No banner image yet.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} />}
          {current ? "Replace image" : "Upload image"}
        </Button>
        {hasCard ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => extractCardArtworkAction(eventId), "Image cut out of your invitation card.")}>
            {pending ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            Use the one from my card
          </Button>
        ) : null}
        {current ? (
          <>
            <a
              href={`/events/${eventSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-gold-700 underline underline-offset-4"
            >
              <ExternalLink size={14} /> Preview on event page
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => removeCardArtworkAction(eventId), "Removed.", () => setCurrent(null))}
              className="inline-flex items-center gap-1.5 text-sm text-navy-700/60 hover:text-red-600"
            >
              <Trash2 size={14} /> Remove
            </button>
          </>
        ) : null}
      </div>
      {message ? (
        <p className={message.ok ? "mt-3 text-sm text-green-700" : "mt-3 text-sm text-red-600"} role="status">
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
