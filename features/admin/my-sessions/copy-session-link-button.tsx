"use client";

import { useState } from "react";
import { Copy, Loader2 } from "lucide-react";

import { getMySessionShareLinkAction } from "@/features/admin/event-day/actions";

/**
 * "Copy my session's link" for a session_organizer (#106) on
 * /admin/my-sessions — generates the link on first use
 * (getMySessionShareLinkAction, assignment-checked) and copies
 * /session/[token] to the clipboard. Regeneration stays host-only (via
 * event-day-manager.tsx) since invalidating a link an organizer already
 * shared could confuse guests mid-registration without the host's say.
 */
export function CopySessionLinkButton({ scheduleItemId, initialToken }: { scheduleItemId: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    let t = token;
    if (!t) {
      setBusy(true);
      const result = await getMySessionShareLinkAction(scheduleItemId);
      setBusy(false);
      if (!result.success) {
        alert(result.error);
        return;
      }
      t = result.data;
      setToken(t);
    }
    navigator.clipboard.writeText(`${window.location.origin}/session/${t}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-full border border-gold-500/30 px-3 py-1.5 text-xs font-medium text-gold-700 hover:bg-gold-500/10 disabled:opacity-60"
    >
      {busy ? <Loader2 className="animate-spin" size={13} /> : <Copy size={13} />}
      {copied ? "Copied!" : "Copy My Session Link"}
    </button>
  );
}
