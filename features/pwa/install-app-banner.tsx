"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { SITE_NAME } from "@/lib/constants";

const DISMISS_STORAGE_KEY = "everymoment_install_banner_dismissed_until";
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 2500;

type Platform = "ios" | "android" | "other";

/** Minimal shape of the (non-standard, Chromium-only) BeforeInstallPromptEvent. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) && !("MSStream" in window)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || navigatorStandalone === true;
}

/**
 * Quiet, dismissible nudge to install {SITE_NAME} as an app (PWA) —
 * "Add to Home Screen" on iOS Safari, a real one-tap native install
 * prompt on Android/Chrome (captured via the non-standard
 * `beforeinstallprompt` event; no equivalent exists on iOS, hence the
 * two different UIs below). See app/manifest.ts for the manifest this
 * relies on and public/sw.js for the (deliberately non-caching)
 * service worker that makes the site installable in the first place.
 *
 * Mounted once from components/layout/site-shell.tsx, so it appears on
 * every public page (platform homepage, every event page, memories
 * upload page, etc.) but never inside /admin, which has its own shell.
 * Self-suppresses entirely when already running standalone (installed)
 * or on desktop browsers, where "installing" isn't a guest-relevant
 * action worth interrupting the RSVP/upload flow for.
 */
export function InstallAppBanner() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedUntil = Number(localStorage.getItem(DISMISS_STORAGE_KEY) ?? 0);
    if (dismissedUntil && Date.now() < dismissedUntil) return;

    const detected = detectPlatform();
    setPlatform(detected);

    function handleBeforeInstallPrompt(event: Event) {
      // Chrome/Edge/Android only — prevent the default mini-infobar so
      // our own banner (matching the rest of the site's design) is the
      // only install UI a guest sees.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setPlatform("android");
      setVisible(true);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // iOS has no beforeinstallprompt event at all, so show the
    // "Add to Home Screen" instructions on a short timer instead of
    // waiting for an event that will never fire.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (detected === "ios") {
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(
      DISMISS_STORAGE_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
    );
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible || installed || platform === "other") return null;

  return (
    <div
      role="dialog"
      aria-label={`Install ${SITE_NAME} app`}
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:bottom-5 sm:px-0"
    >
      <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-gold-500/25 bg-navy-950 px-4 py-3 text-ivory-50 shadow-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
          <Download size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm text-ivory-50">Install the {SITE_NAME} app</p>

          {platform === "ios" ? (
            <p className="mt-1 text-xs leading-relaxed text-ivory-50/70">
              Tap <Share size={12} className="mx-0.5 mb-0.5 inline" aria-hidden />{" "}
              <span className="font-medium text-ivory-50/90">Share</span>, then{" "}
              <SquarePlus size={12} className="mx-0.5 mb-0.5 inline" aria-hidden />{" "}
              <span className="font-medium text-ivory-50/90">Add to Home Screen</span> for
              one-tap access, no browser tabs.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-ivory-50/70">
              Add it to your home screen for one-tap access — no browser tabs, opens full-screen.
            </p>
          )}

          <div className="mt-2 flex items-center gap-4">
            {platform === "android" && deferredPrompt ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-medium text-navy-950 transition-luxury duration-300 hover:brightness-110"
              >
                Install
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-ivory-50/50 hover:text-ivory-50/80"
            >
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
