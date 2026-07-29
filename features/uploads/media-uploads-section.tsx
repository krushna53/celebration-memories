"use client";

import { useState } from "react";
import { Camera, Mic, PenLine, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { PhotoUpload } from "@/features/uploads/components/photo-upload";
import { VideoUpload } from "@/features/uploads/components/video-upload";
import { AudioUpload } from "@/features/uploads/components/audio-upload";
import { GuestbookForm } from "@/features/guestbook/guestbook-form";

interface MediaUploadsSectionProps {
  token: string;
  /** Which tab is active on first render. Defaults to "photo". The public memories page (/events/[slug]/memories) passes "video" since that's what it's built for. */
  defaultTab?: "photo" | "video" | "audio" | "text";
}

const TABS = [
  { key: "photo", label: "Photos", icon: Camera },
  { key: "video", label: "Video", icon: Video },
  { key: "audio", label: "Audio", icon: Mic },
  { key: "text", label: "Note", icon: PenLine },
] as const;

/**
 * "Share Your Memories" — guest photo/video/audio/text uploads, shown on
 * the personalized invite page below the RSVP form and on the public
 * /events/[slug]/memories page. The "Note" tab renders the same
 * GuestbookForm used to power the Guest Book — a written message is just
 * another kind of memory, so it lives here as a tab instead of a
 * separate section. All four kinds are queued for admin approval before
 * appearing on the public Memory Wall.
 */
export function MediaUploadsSection({ token, defaultTab = "photo" }: MediaUploadsSectionProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(defaultTab);

  return (
    <div className="rounded-2xl border border-gold-500/15 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "tap-target flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-luxury duration-200 sm:flex-row sm:justify-center sm:gap-2 sm:text-sm",
              tab === key
                ? "border-gold-500 bg-gold-500/10 text-navy-950"
                : "border-navy-950/10 text-navy-700/60 hover:border-gold-400",
            )}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "photo" ? <PhotoUpload token={token} /> : null}
        {tab === "video" ? <VideoUpload token={token} /> : null}
        {tab === "audio" ? <AudioUpload token={token} /> : null}
        {tab === "text" ? <GuestbookForm token={token} /> : null}
      </div>

      <p className="mt-6 text-center text-xs text-navy-700/50">
        Your memories are reviewed before appearing on the public Memory Wall.
      </p>
    </div>
  );
}
