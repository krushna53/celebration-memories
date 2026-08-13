"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { QrCode as QrCodeIcon } from "lucide-react";

import { getMyCheckInCodeAction } from "@/features/rsvp-payment/actions";

declare global {
  interface Window {
    QRCode?: new (element: HTMLElement, options: { text: string; width: number; height: number; colorDark: string; colorLight: string }) => unknown;
  }
}

/**
 * Shows a guest their own check-in code for one session (#106) — a QR
 * image (rendered client-side only, via the small, dependency-free
 * davidshimjs/qrcode.js loaded from cdnjs, the same next/script CDN
 * pattern already used by features/analytics/clarity-script.tsx) plus
 * the plain alphanumeric code underneath as a manual-entry fallback for
 * browsers/devices where scanning isn't convenient. Mounted inside
 * SessionRegisterButton's "registered" state, so it only ever renders
 * once a session_registrations row genuinely exists.
 */
export function CheckInCodeDisplay({ scheduleItemId, inviteeId }: { scheduleItemId: string; inviteeId: string }) {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    getMyCheckInCodeAction(scheduleItemId, inviteeId).then((result) => {
      if (result.success) setQrToken(result.qrToken);
    });
    // The library may already be loaded (a second session card on the same page) — next/script only fires onLoad for the instance that actually triggers the load.
    if (window.QRCode) setScriptReady(true);
  }, [scheduleItemId, inviteeId]);

  useEffect(() => {
    if (!scriptReady || !qrToken || !containerRef.current || renderedRef.current || !window.QRCode) return;
    renderedRef.current = true;
    new window.QRCode(containerRef.current, {
      text: qrToken,
      width: 120,
      height: 120,
      colorDark: "#111827",
      colorLight: "#ffffff",
    });
  }, [scriptReady, qrToken]);

  if (!qrToken) return null;

  return (
    <>
      <Script
        id="qrcodejs-lib"
        src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div className="mt-3 rounded-lg border border-gold-500/20 bg-navy-900/40 p-3.5 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-ivory-50">
          <QrCodeIcon size={13} /> Your check-in code
        </p>
        <div ref={containerRef} className="mx-auto mt-2 flex w-[120px] items-center justify-center" />
        <p className="mt-2 font-mono text-sm tracking-[0.2em] text-gold-300">{qrToken}</p>
        <p className="mt-1 text-[11px] text-ivory-100/50">Show this at the door — scanned or typed in.</p>
      </div>
    </>
  );
}
