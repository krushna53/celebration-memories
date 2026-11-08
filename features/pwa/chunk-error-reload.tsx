"use client";

import { useEffect } from "react";

import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload";

/**
 * Site-wide listener that reloads the page once when a Next.js script
 * chunk fails to download (see lib/chunk-reload.ts). Covers chunks
 * requested outside React's render — a <script> tag that 503s, or a
 * lazy import's rejected promise; render-time failures are caught by
 * app/global-error.tsx with the same helper. Mounted once from the
 * root layout, same pattern as features/pwa/service-worker-register.tsx.
 */
export function ChunkErrorReload() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const target = event.target;
      const failedScript =
        target instanceof HTMLScriptElement && target.src.includes("/_next/static/");
      if (failedScript || isChunkLoadError(event.error)) reloadOnceForChunkError();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) reloadOnceForChunkError();
    };

    // Capture phase: a <script> load failure doesn't bubble to window.
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
