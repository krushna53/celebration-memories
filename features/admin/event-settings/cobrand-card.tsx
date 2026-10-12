"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { updateEventCobrandAction } from "@/features/admin/event-settings/cobrand-actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * "Powered by <agency>" for agency-run events — a small credit line on
 * the event site and invite page (services/event-cobrand.ts).
 */
export function CobrandCard({
  eventId,
  initialName,
  initialUrl,
}: {
  eventId: string;
  initialName: string;
  initialUrl: string;
}) {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateEventCobrandAction(eventId, name, url);
      setMessage(result.success ? { ok: true, text: name.trim() ? "Saved." : "Removed." } : { ok: false, text: result.error });
    });
  }

  return (
    <section className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg text-navy-950">Co-branding</h2>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/65">
        Running this event for a client? Show &ldquo;Powered by your agency&rdquo; on the event site and every invite page.
        Leave the name empty to hide it.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
          Agency / partner name
          <input
            className={inputClasses}
            value={name}
            maxLength={60}
            placeholder="e.g. CorpCrew"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70">
          Website (optional)
          <input
            className={inputClasses}
            value={url}
            maxLength={200}
            type="url"
            inputMode="url"
            placeholder="https://"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          Save co-branding
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
