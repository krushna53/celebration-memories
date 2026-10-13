"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateWhatsAppContactAction } from "@/features/admin/event-settings/whatsapp-contact-actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "grid gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

/** Event Settings card for the "Message us on WhatsApp" button shown next to RSVP. */
export function WhatsAppContactCard({
  eventId,
  initialNumber,
  initialLabel,
  corporate,
}: {
  eventId: string;
  initialNumber: string;
  initialLabel: string;
  corporate: boolean;
}) {
  const [number, setNumber] = useState(initialNumber ? `+${initialNumber}` : "");
  const [label, setLabel] = useState(initialLabel);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateWhatsAppContactAction(eventId, number, label);
      if (result.success) {
        setNumber(result.number ? `+${result.number}` : "");
        setMessage({ ok: true, text: result.number ? "Saved — the button now shows next to RSVP." : "Removed." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-navy-950">WhatsApp contact</h2>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/65">
        Adds a &ldquo;Message us on WhatsApp&rdquo; button next to RSVP on the event page and every invite page, so
        {corporate ? " attendees" : " guests"} can ask a question in one tap. Leave the number empty to hide it. If your
        invitation card shows a WhatsApp number, it&rsquo;s filled in for you when the card is read.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={labelClasses}>
          WhatsApp number
          <input
            className={inputClasses}
            value={number}
            type="tel"
            inputMode="tel"
            placeholder="+91 70226 42121"
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <label className={labelClasses}>
          Button text (optional)
          <input
            className={inputClasses}
            value={label}
            maxLength={60}
            placeholder="Message us on WhatsApp"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          Save WhatsApp contact
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
