"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ImageUp, Loader2, PenLine, RefreshCw, ScanText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compression";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WizardBackLink } from "@/features/start/wizard-back-link";
import type { RequestUploadUrlResult } from "@/features/admin/ai-image/actions";
import type { AdminActionResult } from "@/features/admin/event-settings/actions";
import type { ReadInvitationCardResult } from "@/features/start/actions/card";

interface CardUploadActions {
  requestUpload: (eventId: string, fileName: string, contentType: string, fileSize: number) => Promise<RequestUploadUrlResult>;
  recordUpload: (eventId: string, path: string) => Promise<AdminActionResult>;
  readCard: (eventId: string, path: string) => Promise<ReadInvitationCardResult>;
}

type Phase = "idle" | "uploading" | "reading";

/**
 * The wizard's "Your Card" step (app/start/[token]/card/page.tsx): asks
 * whether the host already has an invitation card. "No" goes straight
 * to Event Details as before. "Yes" uploads the card (same signed-upload
 * path as the AI Image step's "Upload your own" tab, so it shows up
 * there too), saves it as the invitation/link-preview image, and reads
 * its details with AI so Event Details opens pre-filled — see
 * features/start/actions/card.ts.
 */
export function CardUploadStep({
  token,
  eventId,
  goals,
  initialCardUrl,
  basicsHref,
  actions,
}: {
  token: string;
  eventId: string;
  goals: string[] | null;
  /** The draft's current card, if one was already uploaded on this step — shown on a revisit instead of the question. */
  initialCardUrl: string | null;
  basicsHref: string;
  actions: CardUploadActions;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCard, setHasCard] = useState<boolean>(Boolean(initialCardUrl));
  const [cardUrl, setCardUrl] = useState<string | null>(initialCardUrl);
  const [phase, setPhase] = useState<Phase>("idle");
  const [filled, setFilled] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const busy = phase !== "idle";

  async function handleFile(file: File) {
    setError(null);
    setNotice(null);
    setFilled(null);
    setPhase("uploading");
    try {
      const compressed = await compressImage(file, { maxDimension: 2400, quality: 0.9 });
      const signed = await actions.requestUpload(eventId, compressed.name, compressed.type, compressed.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token: uploadToken } = signed.data;
      const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, uploadToken, compressed);
      if (uploadError) throw new Error(uploadError.message);
      setCardUrl(signed.data.viewUrl);

      // Lets the card survive a reload and show up in the AI Image step's
      // "Upload your own" preview later — best effort, like the generator's own upload.
      const recorded = await actions.recordUpload(eventId, path);
      if (!recorded.success) console.error("Failed to persist uploaded card:", recorded.error);

      setPhase("reading");
      const read = await actions.readCard(eventId, path);
      if (!read.success) throw new Error(read.error);
      setFilled(read.filled);
      setNotice(read.readError);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please try again.");
    } finally {
      setPhase("idle");
    }
  }

  function goToDetails(fromCard: boolean) {
    setLeaving(true);
    router.push(fromCard ? `${basicsHref}?fromCard=1` : basicsHref);
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
        e.target.value = "";
      }}
    />
  );

  if (!hasCard) {
    return (
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setHasCard(true)}
            className="flex flex-col items-start gap-2 rounded-xl border-2 border-navy-950/10 p-5 text-left transition-luxury duration-300 hover:border-gold-500/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-navy-950">
              <ImageUp size={18} />
            </span>
            <span className="font-medium text-navy-950">Yes, I have a card</span>
            <span className="text-xs text-navy-700/60">
              Upload it and we&rsquo;ll fill in your event details from it — name, date, time and venue.
            </span>
          </button>
          <button
            type="button"
            disabled={leaving}
            onClick={() => goToDetails(false)}
            className="flex flex-col items-start gap-2 rounded-xl border-2 border-navy-950/10 p-5 text-left transition-luxury duration-300 hover:border-gold-500/40 disabled:cursor-wait"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-950/5 text-navy-700/60">
              {leaving ? <Loader2 size={18} className="animate-spin" /> : <PenLine size={18} />}
            </span>
            <span className="font-medium text-navy-950">No, not yet</span>
            <span className="text-xs text-navy-700/60">
              Fill in your event details yourself — you can design a card with AI later on.
            </span>
          </button>
        </div>
        <div className="mt-8 border-t border-navy-950/10 pt-6">
          <WizardBackLink token={token} slug="card" goals={goals} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {fileInput}

      {cardUrl ? (
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="relative overflow-hidden rounded-xl border border-navy-950/10 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardUrl} alt="Your invitation card" className="h-auto w-full" />
            {busy ? (
              <div className="absolute inset-0 flex items-center justify-center bg-navy-950/40">
                <Loader2 className="animate-spin text-ivory-50" size={26} />
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-navy-950/10 bg-white p-5">
            {phase === "reading" ? (
              <div className="flex items-start gap-3" role="status">
                <ScanText className="mt-0.5 shrink-0 text-gold-600" size={20} />
                <div>
                  <p className="font-medium text-navy-950">Reading your card&hellip;</p>
                  <p className="mt-1 text-xs text-navy-700/60">
                    Picking out the name, date, time and venue. This usually takes a few seconds.
                  </p>
                </div>
              </div>
            ) : phase === "uploading" ? (
              <p className="text-sm text-navy-700/70" role="status">
                Uploading your card&hellip;
              </p>
            ) : filled && filled.length > 0 ? (
              <div>
                <p className="font-medium text-navy-950">We filled in these details from your card:</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {filled.map((label) => (
                    <li
                      key={label}
                      className="inline-flex items-center gap-1 rounded-full bg-gold-500/10 px-2.5 py-1 text-xs text-navy-950"
                    >
                      <Check size={12} className="text-gold-700" /> {label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-navy-700/60">
                  Please check them on the next step — AI can misread small print.
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-navy-950">Your card is saved.</p>
                <p className="mt-1 text-xs text-navy-700/60">
                  {notice ?? "It's set as your invitation card and the image shown when your link is shared."}
                </p>
              </div>
            )}
            {filled && filled.length > 0 && notice ? <p className="mt-2 text-xs text-navy-700/60">{notice}</p> : null}

            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-navy-700/70 underline underline-offset-4 hover:text-navy-950 disabled:cursor-wait"
            >
              <RefreshCw size={13} /> Upload a different card
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-navy-950/20 bg-white px-6 py-12 text-center hover:border-gold-500/50 disabled:cursor-wait"
        >
          {busy ? <Loader2 className="animate-spin text-navy-700/50" size={24} /> : <ImageUp className="text-navy-700/40" size={24} />}
          <span className="text-sm text-navy-700/70">{busy ? "Uploading..." : "Tap to choose your invitation card"}</span>
          <span className="text-xs text-navy-700/40">A photo or image of the card — JPEG, PNG, WEBP, or HEIC</span>
        </button>
      )}

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-navy-950/10 pt-6">
        {cardUrl ? (
          <WizardBackLink token={token} slug="card" goals={goals} />
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setHasCard(false)}
            className="text-sm text-navy-700/70 hover:text-navy-950"
          >
            &larr; I don&rsquo;t have a card
          </button>
        )}
        <Button disabled={busy || leaving || !cardUrl} onClick={() => goToDetails(Boolean(filled && filled.length > 0))}>
          {leaving ? <Loader2 className="animate-spin" size={16} /> : null}
          Continue to Event Details <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
