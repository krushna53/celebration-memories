"use client";

import dynamic from "next/dynamic";

// react-player touches browser globals, so it's loaded client-only.
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface VideoPlayerProps {
  url: string;
  /** Shown as a gold-bordered name strip directly under the video frame — lets a viewer see at a glance whose message this is without reading the caption block below. Omitted entirely if not provided (e.g. no author name available). */
  guestName?: string;
}

export function VideoPlayer({ url, guestName }: VideoPlayerProps) {
  return (
    <div className="overflow-hidden rounded-t-xl">
      <div className="aspect-video w-full bg-navy-950">
        <ReactPlayer url={url} controls width="100%" height="100%" />
      </div>
      {guestName ? (
        <div className="border-t-2 border-gold-400 bg-gold-500/10 px-3 py-1.5">
          <p className="truncate text-xs font-medium text-navy-950">
            <span className="text-navy-700/60">From</span> {guestName}
          </p>
        </div>
      ) : null}
    </div>
  );
}
