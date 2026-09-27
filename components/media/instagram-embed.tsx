"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds: { process(): void } };
  }
}

let scriptLoading: Promise<void> | null = null;
function loadInstagramScript(): Promise<void> {
  if (window.instgrm) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.instagram.com/embed.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoading = null;
      reject(new Error("instagram embed script failed"));
    };
    document.body.appendChild(s);
  });
  return scriptLoading;
}

/**
 * Instagram's own embed for a public post/reel (their standard
 * blockquote + embed.js — no API key needed). If the script is blocked
 * or the post is private/deleted, the blockquote's plain "View on
 * Instagram" link still shows, so the card never breaks.
 */
export function InstagramEmbed({ permalink, className }: { permalink: string; className?: string }) {
  const ref = useRef<HTMLQuoteElement>(null);
  useEffect(() => {
    let active = true;
    loadInstagramScript()
      .then(() => active && window.instgrm?.Embeds.process())
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [permalink]);

  return (
    <div className={className}>
      <blockquote
        ref={ref}
        className="instagram-media"
        data-instgrm-permalink={`${permalink}?utm_source=ig_embed`}
        data-instgrm-version="14"
        style={{ margin: 0, maxWidth: "100%", minWidth: 0, width: "100%", border: 0 }}
      >
        <a href={permalink} target="_blank" rel="noopener noreferrer" className="block p-4 text-center text-sm text-navy-700 underline">
          View this post on Instagram
        </a>
      </blockquote>
    </div>
  );
}
