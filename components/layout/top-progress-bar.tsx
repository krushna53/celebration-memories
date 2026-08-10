"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Slim animated gold progress bar across the very top of the viewport
 * during client-side route transitions — the "why did nothing happen
 * when I clicked that" gap between a Link/button click and the new
 * page actually rendering, across the whole app (public site + admin).
 *
 * Next.js 15's App Router doesn't expose a "navigation started/
 * finished" event the way the old Pages Router's `router.events` did,
 * so this patches `history.pushState`/`replaceState` — what the App
 * Router's client-side navigation calls under the hood for both <Link>
 * clicks and `router.push()` — to detect the *start* of a transition,
 * and treats the resolved `usePathname()` changing as the *finish*
 * signal. Deliberately not `useSearchParams()` too (which would also
 * catch query-only navigations) — that hook requires a <Suspense>
 * boundary in Next 15 or it forces the whole tree dynamic, not worth
 * it here. A search-param-only navigation (rare in this app) just
 * rides out the 4-second safety-net timeout below instead of a real
 * "finished" signal, which is a fine trade-off for a page that's
 * usually near-instant anyway.
 *
 * No external dependency (nprogress / nextjs-toploader) — this covers
 * the same ground in about 70 lines without adding one.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function start() {
      if (tickRef.current) return; // already mid-transition
      setVisible(true);
      setProgress(12);
      tickRef.current = setInterval(() => {
        // Eases toward 88% and waits there — the real jump to 100%
        // only happens once finish() fires, so the bar never lies
        // about being done before the new page has actually rendered.
        setProgress((p) => (p < 88 ? Math.min(88, p + Math.max(1, (90 - p) / 12)) : p));
      }, 180);
      if (safetyRef.current) clearTimeout(safetyRef.current);
      safetyRef.current = setTimeout(finish, 4000);
    }

    function finish() {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      if (safetyRef.current) {
        clearTimeout(safetyRef.current);
        safetyRef.current = null;
      }
      setProgress(100);
      hideRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    const originalPush = window.history.pushState.bind(window.history);
    const originalReplace = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
      start();
      return originalPush(...args);
    }) as typeof window.history.pushState;

    window.history.replaceState = ((...args: Parameters<typeof window.history.replaceState>) => {
      start();
      return originalReplace(...args);
    }) as typeof window.history.replaceState;

    // Expose finish() to the pathname-change effect below via a
    // window-scoped ref rather than a second history patch.
    (window as unknown as { __topProgressFinish?: () => void }).__topProgressFinish = finish;

    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      if (tickRef.current) clearInterval(tickRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };
  }, []);

  useEffect(() => {
    // Pathname changing is the "the new route actually rendered" signal.
    (window as unknown as { __topProgressFinish?: () => void }).__topProgressFinish?.();
  }, [pathname]);

  if (!visible) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] bg-transparent">
      <div
        className="h-full bg-gold-500 shadow-[0_0_10px_rgba(255,107,87,0.65)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
