"use client";

import { useEffect, useState } from "react";

import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload";

/**
 * Last-resort error screen, replacing Next.js's bare "Application
 * error" page. A failed script download (usually a brief CDN hiccup
 * right after a deploy — see lib/chunk-reload.ts) reloads the page
 * once on its own; anything else, or a second failure, shows a calm
 * "try again" screen. Must render its own <html>/<body> since it
 * replaces the root layout.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error(error);
    if (isChunkLoadError(error) && reloadOnceForChunkError()) setReloading(true);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf6ee",
          color: "#272257",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <main role="alert" style={{ maxWidth: 420 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 28, margin: "0 0 12px" }}>
            {reloading ? "Refreshing…" : "Something went wrong"}
          </h1>
          {reloading ? null : (
            <>
              <p style={{ margin: "0 0 24px", opacity: 0.75, lineHeight: 1.5 }}>
                The page didn&rsquo;t load properly. Please try again — it usually works on the second go.
              </p>
              <button
                type="button"
                onClick={() => (isChunkLoadError(error) ? window.location.reload() : reset())}
                style={{
                  border: 0,
                  borderRadius: 999,
                  background: "#272257",
                  color: "#f3dfa2",
                  padding: "12px 28px",
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </>
          )}
        </main>
      </body>
    </html>
  );
}
