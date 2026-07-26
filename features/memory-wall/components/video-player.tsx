"use client";

import dynamic from "next/dynamic";

// react-player touches browser globals, so it's loaded client-only.
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

interface VideoPlayerProps {
  url: string;
}

export function VideoPlayer({ url }: VideoPlayerProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-navy-950">
      <ReactPlayer url={url} controls width="100%" height="100%" />
    </div>
  );
}
