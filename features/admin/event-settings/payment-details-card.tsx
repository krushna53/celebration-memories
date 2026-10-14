"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLink, ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  requestPaymentImageUploadAction,
  savePaymentDetailsTextAction,
  setPaymentImageAction,
} from "@/features/admin/event-settings/payment-details-actions";

const TEXT_MAX = 4000;
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Event Settings card for the "Payment Details" section on the event page:
 * text (packages, bank details — line breaks and emojis kept) and/or an
 * image such as a UPI QR code. The section only appears when one is set.
 */
export function PaymentDetailsCard({
  eventId,
  eventSlug,
  initialText,
  initialImageUrl,
}: {
  eventId: string;
  eventSlug: string;
  initialText: string;
  initialImageUrl: string | null;
}) {
  const [text, setText] = useState(initialText);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function saveText() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePaymentDetailsTextAction(eventId, text);
      setMessage(result.success ? { ok: true, text: text.trim() ? "Payment details saved." : "Payment text removed." } : { ok: false, text: result.error });
    });
  }

  async function upload(file: File) {
    setMessage(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ ok: false, text: "Use a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ ok: false, text: "That image is too large (max 15 MB)." });
      return;
    }
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);
    setUploading(true);
    try {
      const prep = await requestPaymentImageUploadAction(eventId, file.type, file.size);
      if (!prep.success) throw new Error(prep.error);
      const put = await fetch(prep.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("The upload didn't go through — please try again.");
      const done = await setPaymentImageAction(eventId, prep.path);
      if (!done.success) throw new Error(done.error);
      setImageUrl(done.url);
      setMessage({ ok: true, text: "Image saved." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
      setLocalPreview(null);
      URL.revokeObjectURL(preview);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeImage() {
    startTransition(async () => {
      const result = await setPaymentImageAction(eventId, null);
      if (result.success) {
        setImageUrl(null);
        setMessage({ ok: true, text: "Image removed." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  const shownImage = localPreview ?? imageUrl;
  const busy = pending || uploading;

  return (
    <section className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-navy-950">Payment details</h2>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/65">
        Shown in a &ldquo;Payment Details&rdquo; section on your event page — packages and prices, bank details, a UPI QR
        code. Add text, an image, or both. Leave both empty to hide the section. You can move or hide it in Homepage sections.
      </p>

      <label className="mt-4 grid gap-1.5">
        <span className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">Text</span>
        <textarea
          className="min-h-[180px] w-full resize-y rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm leading-relaxed text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
          value={text}
          maxLength={TEXT_MAX}
          placeholder={"e.g.\nCouple — ₹16,000\nSingle — ₹8,000\n\nBANK DETAILS\nName: …\nA/C #: …\nIFSC: …"}
          onChange={(e) => setText(e.target.value)}
        />
        <span className="text-right text-xs text-navy-700/50">
          {text.length} / {TEXT_MAX}
        </span>
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={saveText} disabled={busy}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          Save text
        </Button>
        <a
          href={`/events/${eventSlug}#payment`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-gold-700 underline underline-offset-4"
        >
          <ExternalLink size={14} /> Preview on event page
        </a>
      </div>

      <div className="mt-6 border-t border-navy-950/10 pt-5">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">Image (optional)</p>
        {shownImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shownImage} alt="Payment details image preview" className={`mt-3 h-auto max-h-72 w-auto max-w-full rounded-lg border border-navy-950/10 object-contain ${uploading ? "opacity-60" : ""}`} />
        ) : (
          <p className="mt-2 text-sm text-navy-700/50">No image — e.g. upload a UPI QR code or a screenshot of your bank details.</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
          <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} />}
            {imageUrl ? "Replace image" : "Upload image"}
          </Button>
          {imageUrl ? (
            <button type="button" disabled={busy} onClick={removeImage} className="inline-flex items-center gap-1.5 text-sm text-navy-700/60 hover:text-red-600">
              <Trash2 size={14} /> Remove image
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className={message.ok ? "mt-3 text-sm text-green-700" : "mt-3 text-sm text-red-600"} role="status">
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
