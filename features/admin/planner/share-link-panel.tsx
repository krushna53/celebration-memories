"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, MessageCircle, RefreshCw, Loader2 } from "lucide-react";

import { regeneratePlannerShareLinkAction } from "@/features/admin/planner/actions";

/**
 * Shows the one link the client shares with family members to grant
 * planner access — see services/event-planner.ts's doc comment for why
 * this is a single shared link rather than per-person invites.
 */
export function PlannerShareLinkPanel({ eventId, token, honoreeName }: { eventId: string; token: string; honoreeName: string }) {
  const [currentToken, setCurrentToken] = useState(token);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const link = origin ? `${origin}/plan/${currentToken}` : "";

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function shareViaWhatsApp() {
    const text = `Help plan ${honoreeName}'s celebration with us — add to-dos and notes here: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function regenerate() {
    if (!confirm("This will make the old link stop working for anyone who already has it. Continue?")) return;
    setError(null);
    startTransition(async () => {
      const result = await regeneratePlannerShareLinkAction(eventId);
      if (result.success) {
        setCurrentToken(result.data);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-4">
      <p className="text-sm font-medium text-navy-950">Family planning link</p>
      <p className="mt-1 text-xs text-navy-700/60">
        Anyone with this link can add and edit to-dos and notes — no account needed. Share it only with people you
        trust to help plan.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-navy-950/10 bg-white px-3 py-2 text-xs text-navy-700">
          {link || "Loading..."}
        </code>
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className="flex items-center gap-1.5 rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={shareViaWhatsApp}
          disabled={!link}
          className="flex items-center gap-1.5 rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
        >
          <MessageCircle size={13} /> WhatsApp
        </button>
        <button
          type="button"
          onClick={regenerate}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 hover:border-navy-950/30 hover:text-navy-950"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reset Link
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
