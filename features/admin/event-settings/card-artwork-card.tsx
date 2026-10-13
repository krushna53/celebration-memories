"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { extractCardArtworkAction, removeCardArtworkAction } from "@/features/admin/templates/card-template-actions";

/** Event Settings card: the illustration cropped off the invitation card, shown under the hero. */
export function CardArtworkCard({ eventId, artworkUrl, hasCard }: { eventId: string; artworkUrl: string | null; hasCard: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<{ success: true } | { success: false; error: string }>, ok: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        setMessage({ ok: true, text: ok });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-navy-950">Invitation card illustration</h2>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/65">
        The main picture from your invitation card, shown right under the top of your event page. It&rsquo;s cropped out
        automatically when your card is read{hasCard ? " — or extract it now." : ". Upload your invitation card first (your link preview image)."}
      </p>
      {artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artworkUrl} alt="Illustration from your invitation card" className="mt-4 h-auto max-h-64 w-auto rounded-lg border border-navy-950/10 object-contain" />
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {hasCard ? (
          <Button type="button" variant={artworkUrl ? "outline" : "default"} disabled={pending} onClick={() => run(() => extractCardArtworkAction(eventId), "Illustration updated.")}>
            {pending ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            {artworkUrl ? "Extract again from my card" : "Extract from my card"}
          </Button>
        ) : null}
        {artworkUrl ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => removeCardArtworkAction(eventId), "Removed.")}
            className="inline-flex items-center gap-1.5 text-sm text-navy-700/60 hover:text-red-600"
          >
            <Trash2 size={14} /> Remove from event page
          </button>
        ) : null}
        {message ? (
          <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
