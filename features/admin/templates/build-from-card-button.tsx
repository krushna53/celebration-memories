"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildTemplateFromCardAction } from "@/features/admin/templates/card-template-actions";

/** "Build a template from my invitation card" — Templates page, shown when the event has a card uploaded. */
export function BuildFromCardButton({ eventId, hasCardTemplate }: { eventId: string; hasCardTemplate: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function build() {
    setMessage(null);
    startTransition(async () => {
      const result = await buildTemplateFromCardAction(eventId);
      if (result.success) {
        setMessage({ ok: true, text: `Done — your site now uses "Matched to your card". Picked up: ${result.filled.join(", ")}.` });
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <section className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-5">
      <h2 className="font-display text-lg text-navy-950">Match your invitation card</h2>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/70">
        We read the colours and type style off your invitation card and build a template that looks like it.
        {hasCardTemplate ? " You already have one — rebuild it if you've changed your card." : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={build} disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {hasCardTemplate ? "Rebuild from my card" : "Build a template from my card"}
        </Button>
        {message ? (
          <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-600"} role="status">
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
