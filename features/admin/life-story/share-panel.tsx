"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2, MessageCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LifeStoryBundle } from "@/types/life-story";
import { resetShareLinkAction, setSharingAction } from "@/features/admin/life-story/actions";
import { BiographyView } from "@/features/life-story/biography-view";
import { card, errorText, hint } from "@/features/admin/life-story/styles";

/**
 * Step 5 — sharing. Off by default: the biography, its photos and the film
 * are private to the event team until the host switches this on. Anyone
 * with the link can then read it (no login), and resetting the link
 * cuts off everyone who had the old one.
 */
export function SharePanel({ eventId, bundle, shareUrl: initialUrl }: { eventId: string; bundle: LifeStoryBundle; shareUrl: string }) {
  const router = useRouter();
  const [shared, setShared] = useState(bundle.story.isShared);
  const [shareUrl, setShareUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = bundle.story.title || bundle.story.subjectName;

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await setSharingAction(eventId, next);
    setBusy(false);
    if (!res.success) return setError(res.error);
    setShared(next);
    router.refresh();
  }

  async function reset() {
    if (!window.confirm("Make a new link? The old link will stop working for everyone who has it.")) return;
    setBusy(true);
    const res = await resetShareLinkAction(eventId);
    setBusy(false);
    if (!res.success) return setError(res.error);
    setShareUrl(shareUrl.replace(/[a-f0-9]{36}$/, res.data.shareToken));
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`The life story of ${title} — read it and watch the film: ${shareUrl}`)}`;

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="font-display text-lg text-navy-950">Share</h2>
        <label className="mt-3 flex items-start gap-3 text-sm text-navy-950">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-navy-950/30 text-gold-500 focus:ring-gold-500/40"
            checked={shared}
            disabled={busy}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span>
            Anyone with the link can read the biography, watch the film and download the book
            <span className={`block ${hint}`}>Off = only your event team can see it. Photos stay private either way unless this is on.</span>
          </span>
        </label>
        {shared ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="max-w-full truncate rounded bg-ivory-100 px-3 py-2 text-xs text-navy-900">{shareUrl}</code>
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset} disabled={busy} className="text-navy-700/70">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              New link
            </Button>
          </div>
        ) : null}
        {error ? <p className={`mt-3 ${errorText}`}>{error}</p> : null}
      </section>

      <section aria-label="Preview" className="overflow-hidden rounded-xl border border-navy-950/10 shadow-sm">
        <p className="bg-white px-4 py-2 text-xs uppercase tracking-[0.15em] text-navy-700/60">Preview</p>
        {bundle.chapters.length ? (
          <BiographyView bundle={bundle} />
        ) : (
          <p className="bg-white px-4 pb-6 text-sm text-navy-700/60">Write the biography in step 3 to see it here.</p>
        )}
      </section>
    </div>
  );
}
