"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Copy, MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildWhatsAppInviteUrl, THANK_YOU_MESSAGE_TEMPLATE } from "@/lib/whatsapp";
import type { InviteeRecord } from "@/types/event";

interface BulkSendPanelProps {
  invitees: InviteeRecord[];
  origin: string;
  hostedBy: string;
  honoreeName: string;
  messageTemplate: string | null;
  /** True once the event is over — the panel then defaults to the "Thank you + share your photos" message. */
  eventEnded?: boolean;
  onOpen: (inviteeId: string) => void;
  onClose: () => void;
}

/**
 * A step-through queue for sending WhatsApp invites to many guests.
 *
 * Important honesty note baked into the UI copy: WhatsApp's `wa.me` deep
 * links only support one contact at a time — there is no code-level way
 * to fire off a true one-click bulk send without the paid WhatsApp
 * Business API + Meta template approval. This panel is the realistic
 * middle ground: it queues guests with a phone number who haven't been
 * sent yet, and lets the admin tap through them quickly (each tap opens
 * WhatsApp pre-filled, then auto-advances). "Copy All Links" is the
 * alternative for admins who'd rather paste into their own broadcast
 * list or bulk-messaging tool.
 */
export function BulkSendPanel({
  invitees,
  origin,
  hostedBy,
  honoreeName,
  messageTemplate,
  eventEnded = false,
  onOpen,
  onClose,
}: BulkSendPanelProps) {
  const [mode, setMode] = useState<"invite" | "thanks">(eventEnded ? "thanks" : "invite");
  const [onlyUnsent, setOnlyUnsent] = useState(true);
  // Thank-you sends are tracked for this session only — they must not overwrite "invite sent".
  const [thankedIds, setThankedIds] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const queue = useMemo(() => {
    const withPhone = invitees.filter((inv) => inv.phone);
    if (mode === "thanks") return onlyUnsent ? withPhone.filter((inv) => !thankedIds.has(inv.id)) : withPhone;
    return onlyUnsent ? withPhone.filter((inv) => !inv.inviteSentAt) : withPhone;
    // thankedIds only matters in "thanks" mode; recomputing the queue as it changes would skip guests mid-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitees, onlyUnsent, mode]);

  const current = queue[index] ?? null;
  const remainingAfterCurrent = Math.max(queue.length - index - 1, 0);

  function currentLink(inv: InviteeRecord) {
    return buildWhatsAppInviteUrl({
      guestName: inv.name,
      phone: inv.phone!,
      inviteUrl: mode === "thanks" ? `${origin}/invite/${inv.token}#share` : `${origin}/invite/${inv.token}`,
      hostedBy,
      honoreeName,
      messageTemplate: mode === "thanks" ? THANK_YOU_MESSAGE_TEMPLATE : messageTemplate,
    });
  }

  function handleOpenCurrent() {
    if (!current) return;
    window.open(currentLink(current), "_blank", "noopener,noreferrer");
    if (mode === "thanks") setThankedIds((prev) => new Set(prev).add(current.id));
    else onOpen(current.id);
    setIndex((i) => Math.min(i + 1, queue.length));
  }

  function copyAllLinks() {
    const text = invitees
      .filter((inv) => inv.phone)
      .map((inv) => `${inv.name}: ${currentLink(inv)}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-4 rounded-xl border border-gold-500/25 bg-gold-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-navy-950">{mode === "thanks" ? "Bulk Send Thank-You Messages" : "Bulk Send Invites"}</h3>
          <div className="mt-2 inline-flex rounded-full border border-navy-950/15 bg-white p-0.5 text-xs" role="tablist" aria-label="Message">
            {(
              [
                ["invite", "Invitation"],
                ["thanks", "Thank you + share your photos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => {
                  setMode(value);
                  setIndex(0);
                }}
                className={mode === value ? "rounded-full bg-navy-950 px-3 py-1 text-ivory-50" : "rounded-full px-3 py-1 text-navy-700/70"}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-navy-700/60">
            WhatsApp only lets one conversation open at a time — there&rsquo;s no
            true one-tap &ldquo;send to everyone&rdquo; without WhatsApp&rsquo;s paid Business
            API. This queue makes tapping through your guest list fast: each
            tap opens WhatsApp pre-filled for that guest, marks them sent,
            and moves to the next.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="tap-target flex items-center justify-center text-navy-700/50 hover:text-navy-950"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-navy-700/70">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyUnsent}
            onChange={(e) => {
              setOnlyUnsent(e.target.checked);
              setIndex(0);
            }}
          />
          {mode === "thanks" ? "Only guests not yet thanked (this session)" : "Only guests not yet sent"}
        </label>
        <span>&middot;</span>
        <span>{queue.length} in queue</span>
        <span>&middot;</span>
        <button
          type="button"
          onClick={copyAllLinks}
          className="inline-flex items-center gap-1 text-gold-700 hover:underline"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          Copy all links as text
        </button>
      </div>

      {invitees.some((inv) => !inv.phone) ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
          <AlertTriangle size={13} />
          Guests without a phone number are skipped — add one to include them.
        </p>
      ) : null}

      <div className="mt-4 rounded-lg border border-navy-950/10 bg-white p-4">
        {current ? (
          <>
            <p className="text-xs uppercase tracking-wide text-navy-700/50">
              Guest {index + 1} of {queue.length}
            </p>
            <p className="mt-1 font-display text-lg text-navy-950">{current.name}</p>
            <p className="text-xs text-navy-700/60">{current.phone}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={handleOpenCurrent}>
                <MessageCircle size={15} /> Open WhatsApp &amp; Mark Sent
              </Button>
              {remainingAfterCurrent > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs text-navy-700/50">
                  <ChevronRight size={13} /> {remainingAfterCurrent} more after this
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-navy-700/60">
            {invitees.filter((inv) => inv.phone).length === 0
              ? "No guests with a phone number yet."
              : "Everyone in this list has already been sent an invite. Uncheck “Only guests not yet sent” to resend."}
          </p>
        )}
      </div>
    </div>
  );
}
