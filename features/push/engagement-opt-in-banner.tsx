"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

import { usePushSubscription } from "@/hooks/use-push-subscription";

const DISMISS_STORAGE_KEY = "everymoment_engagement_push_dismissed_until";
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 1500;

interface EngagementOptInBannerProps {
  token: string;
  honoreeName: string;
}

/**
 * A second, broader push opt-in beyond the two narrow moments already
 * built (NotificationPrompt on an unfinished upload / after RSVP) —
 * this one offers general event updates (countdown milestones, "new
 * photos added"). Shown to any guest whose platform can actually
 * receive Web Push right now (usePushSubscription's `supported` flag —
 * see lib/pwa.ts's canRequestPushNow): that's every guest on Android/
 * Chrome/desktop browsers in a normal tab, and iPhone guests only once
 * they've installed the app (Apple's own restriction, not a choice
 * made here — a non-installed iOS Safari tab genuinely cannot receive
 * push notifications at all).
 *
 * Mounted on the personal /invite/[token] page only (see that page's
 * component tree) — the one place a guest has a stable token this
 * early, before they've necessarily touched the upload flow or RSVP.
 */
export function EngagementOptInBanner({ token, honoreeName }: EngagementOptInBannerProps) {
  const { permission, isSubscribed, busy, supported, subscribe } = usePushSubscription(token);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dismissedUntil = Number(localStorage.getItem(DISMISS_STORAGE_KEY) ?? 0);
    if (dismissedUntil && Date.now() < dismissedUntil) return;

    const timer = setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
  }

  async function handleEnable() {
    await subscribe();
  }

  if (!ready || !supported || permission !== "default" || isSubscribed || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Enable event notifications"
      data-floating className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:bottom-5 sm:px-0"
    >
      <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-gold-500/25 bg-navy-950 px-4 py-3 text-ivory-50 shadow-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
          <Bell size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm text-ivory-50">Stay in the loop?</p>
          <p className="mt-1 text-xs leading-relaxed text-ivory-50/70">
            Get a nudge as {honoreeName}&rsquo;s big day gets closer, and whenever new photos are added — right on
            your phone.
          </p>
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-medium text-navy-950 transition-luxury duration-300 hover:brightness-110 disabled:opacity-60"
            >
              Turn on notifications
            </button>
            <button type="button" onClick={dismiss} className="text-xs text-ivory-50/50 hover:text-ivory-50/80">
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-ivory-50/40 hover:text-ivory-50/80"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
