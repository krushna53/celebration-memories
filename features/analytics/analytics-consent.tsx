"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GoogleAnalytics } from "./google-analytics";

const KEY = "everymoment.analytics.v1";

/** No analytics code mounts until an affirmative, versioned choice exists. */
export function AnalyticsConsent() {
  const [choice, setChoice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const configured = /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "");

  useEffect(() => {
    try { setChoice(localStorage.getItem(KEY)); } catch { /* Default to no analytics. */ }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) window.location.reload();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function save(accepted: boolean) {
    const value = accepted ? "accepted" : "declined";
    try { localStorage.setItem(KEY, value); } catch { return; }
    if (!accepted) {
      // Stop the loaded tracker before reloading. Remove first-party GA cookies
      // across host/domain variants; third-party storage remains provider-owned.
      const analytics = window as unknown as Record<string, unknown>;
      analytics[`ga-disable-${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()}`] = true;
      for (const cookie of document.cookie.split(";")) {
        const name = (cookie.split("=")[0] ?? "").trim();
        if (!/^_ga(?:_|$)|^_gid$|^_gat/.test(name)) continue;
        document.cookie = `${name}=; Max-Age=0; Path=/`;
        const parts = window.location.hostname.split(".");
        for (let i = 0; i < parts.length - 1; i++) {
          document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${parts.slice(i).join(".")}`;
        }
      }
    }
    window.location.reload();
  }

  if (!configured || !ready) return null;
  return <>
    {choice === "accepted" ? <GoogleAnalytics /> : null}
    <button type="button" onClick={() => setEditing(true)} className="fixed bottom-3 left-3 z-50 rounded-lg border bg-white px-3 py-2 text-xs text-navy-950 shadow">Privacy choices</button>
    {editing || (choice !== "accepted" && choice !== "declined") ? (
      <section aria-label="Optional analytics" className="fixed bottom-14 left-3 right-3 z-50 max-w-lg rounded-xl border bg-white p-5 text-sm text-navy-950 shadow-xl">
        <p>Allow Google Analytics to measure visits? It uses cookies and sends usage data to Google. This is optional. You can change your choice here at any time. <Link href="/privacy" className="underline">Privacy Notice</Link></p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => save(false)} className="rounded border px-4 py-2">Decline / withdraw</button>
          <button type="button" onClick={() => save(true)} className="rounded border px-4 py-2">Allow analytics</button>
          {editing ? <button type="button" onClick={() => setEditing(false)} className="underline">Close</button> : null}
        </div>
      </section>
    ) : null}
  </>;
}
