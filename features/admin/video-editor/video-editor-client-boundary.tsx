"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import type { VideoEditorClip, VideoEditJob } from "@/services/video-editor";

/**
 * @shotstack/shotstack-studio renders into real DOM canvas/WebGL
 * surfaces (its Canvas/Timeline classes) and can't run during Next.js's
 * server render — `next/dynamic` with `ssr: false` needs a Client
 * Component boundary to live in (using it directly inside an async
 * Server Component page is a build error in the App Router), which is
 * this file's only job. The actual editor lives in
 * video-editor-workspace.tsx.
 */
const VideoEditorWorkspace = dynamic(
  () => import("@/features/admin/video-editor/video-editor-workspace").then((m) => m.VideoEditorWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl border border-navy-950/10 bg-white">
        <Loader2 className="animate-spin text-gold-600" size={24} />
      </div>
    ),
  },
);

export function VideoEditorClientBoundary(props: {
  eventId: string;
  initialMediaLibrary: VideoEditorClip[];
  initialJobs: VideoEditJob[];
  quota: { used: number; limit: number } | null;
}) {
  return <VideoEditorWorkspace {...props} />;
}
