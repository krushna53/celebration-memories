"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { SITE_NAME } from "@/lib/constants";
import { isStandalone } from "@/lib/pwa";

const DISMISS_STORAGE_KEY = "everymoment_install_banner_dismissed_until";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
type Platform = "ios" | "android" | "other";
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Root-mounted so login and dashboards also offer installation. Dismissing
 * the nudge keeps a small launcher; browser install support is optional. */
export function InstallAppBanner() {
  const pathname = usePathname();
  const dismissedThisVisit = useRef(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [mobile, setMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (isStandalone() || capacitor?.isNativePlatform?.()) { setInstalled(true); return; }
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const detected: Platform = ios ? "ios" : /android/i.test(ua) ? "android" : "other";
    setPlatform(detected);
    const viewport = window.matchMedia("(max-width: 767px)");
    const updateMobile = () => setMobile(detected !== "other" || viewport.matches);
    updateMobile();
    viewport.addEventListener("change", updateMobile);

    let dismissed = false;
    try { dismissed = Number(localStorage.getItem(DISMISS_STORAGE_KEY)) > Date.now(); } catch { /* Storage may be blocked. */ }
    const timer = setTimeout(() => { if (!dismissed && !dismissedThisVisit.current) setExpanded(true); }, 2500);
    const onPrompt = (event: Event) => {
      // Keep the browser's default UI on desktop; capture on mobile only.
      if (detected === "other" && !viewport.matches) return;
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setExpanded(false); };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const onDisplayMode = () => { if (isStandalone()) onInstalled(); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener("change", onDisplayMode);
    return () => {
      clearTimeout(timer);
      viewport.removeEventListener("change", updateMobile);
      displayMode.removeEventListener("change", onDisplayMode);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    dismissedThisVisit.current = true;
    setExpanded(false);
    try { localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_MS)); } catch { /* Keep working without storage. */ }
  }
  async function install() {
    if (!prompt || busy) return;
    setBusy(true); setMessage("");
    const current = prompt;
    setPrompt(null); // A native prompt can only be used once.
    try {
      await current.prompt();
      const choice = await current.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      else dismiss();
    } catch { setMessage("Use your browser’s menu to add this app to your home screen."); }
    finally { setBusy(false); }
  }

  if (!mobile || installed || /\/display(?:\/|$)/.test(pathname)) return null;
  return <div className="fixed inset-x-4 z-40 flex justify-start pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}>
    {expanded ? <section id="install-app-panel" aria-label={`Install ${SITE_NAME} app`} className="pointer-events-auto w-full max-w-sm rounded-2xl border border-gold-500/25 bg-navy-950 p-4 text-ivory-50 shadow-xl">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-base"><Download size={18} aria-hidden />Install the {SITE_NAME} app</h2><button type="button" onClick={dismiss} aria-label="Close install instructions" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10"><X size={18} /></button></div>
      {prompt ? <p className="mt-1 text-sm text-ivory-50/80">Add EveryMoment to your home screen for quick access.</p> : platform === "ios" ? <p className="mt-1 text-sm leading-relaxed text-ivory-50/80">Open this page in Safari. Tap <Share size={14} className="inline" aria-hidden /> Share, then <SquarePlus size={14} className="inline" aria-hidden /> Add to Home Screen.</p> : <p className="mt-1 text-sm leading-relaxed text-ivory-50/80">Open your browser menu (⋮) and choose Install app or Add to Home screen. If the option is missing, open this page in Chrome on Android or Safari on iPhone.</p>}
      <div className="mt-3 flex items-center gap-4">{prompt && <button type="button" disabled={busy} onClick={install} className="min-h-11 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 disabled:opacity-50">{busy ? "Opening…" : "Install"}</button>}<button type="button" onClick={dismiss} className="min-h-11 text-sm text-ivory-50/70">Not now</button></div>
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
    </section> : <button type="button" onClick={() => setExpanded(true)} aria-expanded={false} aria-controls="install-app-panel" className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full border border-gold-500/30 bg-navy-950 px-4 py-3 text-sm font-medium text-ivory-50 shadow-lg"><Download size={17} aria-hidden />Install app</button>}
  </div>;
}
