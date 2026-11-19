"use client";

import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

import type { CampaignKind, MailerContact, MailerEmailContent, MailerEvent } from "@/types/mailer";
import { renderEmail } from "@/lib/mailer/email-html";
import { sampleTokenValues, tokenValuesFor } from "@/lib/mailer/tokens";
import { contactDisplayName } from "@/lib/mailer/email";
import { cn } from "@/lib/utils";
import { inputClasses } from "@/features/mailer/components/ui";

/**
 * Renders the email in a sandboxed iframe (no scripts, no same-origin
 * access) at desktop or phone width, personalised for a chosen contact.
 */
export function EmailPreview({
  kind,
  content,
  senderName,
  event,
  contacts,
}: {
  kind: CampaignKind;
  content: MailerEmailContent;
  senderName: string;
  event: MailerEvent | null;
  /** Contacts the person can preview as; empty = sample values. */
  contacts: MailerContact[];
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [contactId, setContactId] = useState<string>("");
  const contact = contacts.find((c) => c.id === contactId) ?? contacts[0] ?? null;

  const rendered = useMemo(() => {
    let values = sampleTokenValues();
    if (contact) {
      values = tokenValuesFor(contact, event, senderName);
    } else {
      // No contacts to preview as: keep the sample person, but use the real event and sender when set.
      const real = tokenValuesFor(null, event, senderName);
      if (event) values = { ...values, event_name: real.event_name, event_date: real.event_date, event_venue: real.event_venue };
      if (real.sender_name) values = { ...values, sender_name: real.sender_name };
    }
    return renderEmail(kind, content, values);
  }, [kind, content, senderName, event, contact]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Preview as"
          value={contact?.id ?? ""}
          onChange={(e) => setContactId(e.target.value)}
          className={cn(inputClasses, "min-w-0 flex-1 py-1.5")}
          disabled={contacts.length === 0}
        >
          {contacts.length === 0 ? <option value="">Preview with sample data</option> : null}
          {contacts.slice(0, 200).map((c) => (
            <option key={c.id} value={c.id}>
              Preview as {contactDisplayName(c)}
            </option>
          ))}
        </select>
        <div className="flex rounded-xl border border-navy-950/12 p-0.5" role="group" aria-label="Preview width">
          {(
            [
              ["desktop", Monitor],
              ["mobile", Smartphone],
            ] as const
          ).map(([d, Icon]) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              aria-pressed={device === d}
              aria-label={d === "desktop" ? "Desktop width" : "Phone width"}
              className={cn("rounded-lg px-2.5 py-1.5", device === d ? "bg-navy-950 text-white" : "text-navy-700/60 hover:text-navy-950")}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-navy-950/10 bg-navy-950/[0.03] px-3 py-2 text-xs">
        <p className="truncate text-navy-950">
          <span className="text-navy-700/55">Subject: </span>
          {rendered.subject || "—"}
        </p>
        {rendered.preheader ? (
          <p className="truncate text-navy-700/60">
            <span className="text-navy-700/45">Preview text: </span>
            {rendered.preheader}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-1 justify-center overflow-x-auto rounded-xl bg-navy-950/[0.04] p-3">
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={rendered.html}
          className={cn("h-[560px] shrink-0 rounded-lg border border-navy-950/10 bg-white transition-all", device === "mobile" ? "w-[375px]" : "w-full min-w-[320px]")}
        />
      </div>
    </div>
  );
}
