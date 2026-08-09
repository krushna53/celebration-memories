"use client";

import { useState } from "react";
import { Bell, Loader2, X } from "lucide-react";

import { usePushSubscription } from "@/hooks/use-push-subscription";

interface NotificationPromptProps {
  token: string;
  /** Defaults to the "unfinished upload" copy (MediaUploadsSection's use case). Override for other moments this prompt is shown — e.g. RsvpForm's post-submit "share a memory" nudge. */
  message?: string;
  /** Defaults to "Remind me". */
  buttonLabel?: string;
}

/**
 * A small, dismissible inline prompt — not an unprompted browser
 * permission popup on page load (those have terrible accept rates and
 * read as spammy). Reused at two moments where opting in is actually
 * relevant, each the best-converting moment to ask for that context:
 *   1. MediaUploadsSection, once a guest has something queued but not
 *      yet uploaded (a recording just captured, or a file just picked)
 *      — "remind me if I don't finish".
 *   2. RsvpForm, right after a guest RSVPs "coming"/"maybe" — so
 *      there's actually a push subscription on file for
 *      send-memory-nudge-push to reach later (a guest who never
 *      touches the upload flow would otherwise never be asked).
 * Renders nothing once permission has already been decided
 * (granted/denied) or on unsupported browsers/when Web Push isn't
 * configured (see usePushSubscription's `supported` flag).
 */
export function NotificationPrompt({
  token,
  message = "Want a reminder if this doesn't finish uploading? We'll send one notification to this device only if it's left unfinished.",
  buttonLabel = "Remind me",
}: NotificationPromptProps) {
  const { permission, isSubscribed, busy, supported, subscribe } = usePushSubscription(token);
  const [dismissed, setDismissed] = useState(false);

  if (!supported || permission !== "default" || isSubscribed || dismissed) return null;

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-gold-500/25 bg-gold-500/5 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
        <Bell size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-navy-950">{message}</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={subscribe}
            disabled={busy}
            className="tap-target flex items-center gap-1.5 rounded-full bg-gold-500 px-3.5 py-1.5 text-xs font-medium text-navy-950 transition-luxury duration-200 disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={12} /> : null}
            {buttonLabel}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="tap-target text-xs font-medium text-navy-700/50 hover:text-navy-950"
          >
            No thanks
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="tap-target shrink-0 text-navy-700/40 hover:text-navy-950"
      >
        <X size={14} />
      </button>
    </div>
  );
}
