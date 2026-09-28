"use client";

import { useEffect } from "react";

/**
 * Casual-copy deterrents for private media (anything served from the
 * signed /media/... route — guest memories and the family gallery; see
 * lib/media-url.ts). Mounted once in the root layout so no individual
 * image/video component has to remember it.
 *
 * - Right-click "Save image as…" and dragging an image to the desktop are
 *   blocked on private media only; everything else on the site behaves
 *   normally.
 * - Videos lose the browser's own download button and picture-in-picture.
 * - The iOS long-press "Save to Photos" menu is suppressed by CSS
 *   (see app/globals.css, `-webkit-touch-callout`).
 *
 * The site's own Download / Share buttons are deliberate and keep
 * working. None of this can stop a screenshot or screen recording — the
 * real protection is that links expire and are only handed to people who
 * can see the page.
 */
function isPrivateMedia(el: Element | null): el is HTMLImageElement | HTMLVideoElement {
  if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return false;
  const src = el.currentSrc || el.getAttribute("src") || el.querySelector("source")?.getAttribute("src") || "";
  return src.includes("/media/") || src.includes("%2Fmedia%2F");
}

function hardenVideo(video: HTMLVideoElement) {
  if (!isPrivateMedia(video)) return;
  video.setAttribute("controlsList", "nodownload");
  video.disablePictureInPicture = true;
}

export function MediaProtection() {
  useEffect(() => {
    const block = (event: Event) => {
      if (isPrivateMedia(event.target as Element | null)) event.preventDefault();
    };
    document.addEventListener("contextmenu", block, true);
    document.addEventListener("dragstart", block, true);

    document.querySelectorAll("video").forEach(hardenVideo);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target instanceof HTMLVideoElement) hardenVideo(m.target);
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLVideoElement) hardenVideo(node);
          else if (node instanceof Element) node.querySelectorAll("video").forEach(hardenVideo);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });

    return () => {
      document.removeEventListener("contextmenu", block, true);
      document.removeEventListener("dragstart", block, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
