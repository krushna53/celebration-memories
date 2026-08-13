"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
    };
  }
}

/**
 * Camera-based QR check-in scanner (#106) — uses the browser's native
 * BarcodeDetector API (Chrome/Edge/Android; not available on Safari/
 * iOS or Firefox as of this build) with getUserMedia for the camera
 * feed. No external scanning library — BarcodeDetector ships in the
 * browser itself. Where it's unsupported, callers should still offer
 * the manual code-entry fallback alongside this component (see
 * session-attendee-table.tsx), so check-in always works either way.
 */
export function QrScanner({ onScan }: { onScan: (code: string) => void }) {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(window.BarcodeDetector));
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new (window.BarcodeDetector as NonNullable<typeof window.BarcodeDetector>)({ formats: ["qr_code"] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value) {
              const now = Date.now();
              const last = lastScanRef.current;
              // Debounce: don't fire the same code twice within 3s (the loop runs many times per second while the code stays in frame).
              if (!last || last.code !== value || now - last.at > 3000) {
                lastScanRef.current = { code: value, at: now };
                onScan(value);
              }
            }
          } catch {
            // Detection errors on a given frame are expected (e.g. no code in view) — just try the next frame.
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setError("Couldn't access the camera — check your browser permissions, or use the code field below instead.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active, onScan]);

  if (!supported) return null;

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setActive(true);
        }}
        className="flex items-center gap-1.5 rounded-full border border-gold-500/30 px-3.5 py-2 text-sm font-medium text-gold-700 hover:bg-gold-500/10"
      >
        <Camera size={15} /> Scan QR to Check In
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy-950/10 bg-navy-950">
      <div className="flex items-center justify-between bg-navy-900 px-3 py-2">
        <p className="text-xs font-medium text-ivory-100/80">Point the camera at a guest&rsquo;s QR code</p>
        <button type="button" onClick={() => setActive(false)} className="tap-target text-ivory-100/60 hover:text-ivory-50">
          <X size={16} />
        </button>
      </div>
      {error ? (
        <p className="p-4 text-center text-xs text-rose-300">{error}</p>
      ) : (
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      )}
    </div>
  );
}
