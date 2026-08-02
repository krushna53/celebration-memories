"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Circle, FileAudio, FileVideo, ImagePlus, Mic, PenLine, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { PhotoUpload } from "@/features/uploads/components/photo-upload";
import { VideoUpload } from "@/features/uploads/components/video-upload";
import { AudioUpload } from "@/features/uploads/components/audio-upload";
import { GuestbookForm } from "@/features/guestbook/guestbook-form";

interface MediaUploadsSectionProps {
  token: string;
}

type View = "menu" | "photo" | "video-record" | "video-upload" | "audio-record" | "audio-upload" | "note";

interface ActionOption {
  view: View;
  label: string;
  icon: typeof ImagePlus;
  /** Small red-dot badge for the two "record" actions, so they read as distinct from their upload counterparts at a glance. */
  isRecordAction?: boolean;
}

const ACTIONS: ActionOption[] = [
  { view: "video-record", label: "Record Video", icon: Video, isRecordAction: true },
  { view: "audio-record", label: "Record Audio", icon: Mic, isRecordAction: true },
  { view: "photo", label: "Upload Image", icon: ImagePlus },
  { view: "video-upload", label: "Upload Video", icon: FileVideo },
  { view: "audio-upload", label: "Upload Audio", icon: FileAudio },
  { view: "note", label: "Add a Text Message", icon: PenLine },
];

const VIEW_TITLES: Record<Exclude<View, "menu">, string> = {
  photo: "Upload Photos",
  "video-record": "Record a Video",
  "video-upload": "Upload a Video",
  "audio-record": "Record a Voice Message",
  "audio-upload": "Upload Audio",
  note: "Write a Message",
};

/**
 * "Share Your Memories" — shown on the personalized invite page below
 * the RSVP form and on the public /events/[slug]/memories ("Share a
 * Memory") page. Leads with 6 direct-action icons (Record Video, Record
 * Audio, Upload Image, Upload Video, Upload Audio, Add a Text Message)
 * rather than a Photo/Video/Audio/Note tab bar that then required a
 * second tap to choose upload vs. record — tapping Record Video/Audio
 * here lands straight on the camera/mic view (see VideoUpload/
 * AudioUpload's `initialMode` prop), so recording is one tap away
 * instead of two. All six land in the same admin approval queue before
 * appearing on the public Memory Wall.
 *
 * The three useMediaUpload instances live here, one level above the
 * views that render them, and get passed down as props rather than
 * called inside PhotoUpload/VideoUpload/AudioUpload themselves.
 * Previously each of those components owned its own upload queue
 * locally, so picking photos, then switching to Video before hitting
 * "Upload All", silently lost every picked-but-not-yet-uploaded photo
 * when PhotoUpload unmounted. Owning the state here, in a component
 * that stays mounted across every view change, means a pending queue
 * in any of the three survives switching around and coming back.
 */
export function MediaUploadsSection({ token }: MediaUploadsSectionProps) {
  const [view, setView] = useState<View>("menu");
  const photoUpload = useMediaUpload(token, "photo");
  const videoUpload = useMediaUpload(token, "video");
  const audioUpload = useMediaUpload(token, "audio");
  const sectionRef = useRef<HTMLDivElement>(null);

  // Scrolls the record/upload panel into view whenever it appears — on
  // mobile, tapping "Record Video"/"Record Audio" from the menu could
  // otherwise leave the camera preview and Start/Stop controls below the
  // fold if the guest had scrolled partway down the page to find this
  // section in the first place.
  useEffect(() => {
    if (view !== "menu") {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  const pendingCountByView: Partial<Record<View, number>> = {
    photo: photoUpload.items.filter((it) => it.status !== "done").length,
    "video-upload": videoUpload.items.filter((it) => it.status !== "done").length,
    "video-record": 0,
    "audio-upload": audioUpload.items.filter((it) => it.status !== "done").length,
    "audio-record": 0,
  };

  if (view === "menu") {
    return (
      <div className="rounded-2xl border border-gold-500/15 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACTIONS.map(({ view: target, label, icon: Icon, isRecordAction }) => {
            const pending = pendingCountByView[target] ?? 0;
            return (
              <button
                key={target}
                type="button"
                onClick={() => setView(target)}
                className="tap-target group relative flex flex-col items-center gap-2 rounded-xl border border-navy-950/10 bg-ivory-50 px-3 py-5 text-center transition-luxury duration-200 hover:border-gold-500 hover:bg-gold-500/5"
              >
                {isRecordAction ? (
                  <span className="absolute right-2 top-2 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500">
                    <Circle size={6} className="fill-white text-white" />
                  </span>
                ) : null}
                {pending > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-semibold text-navy-950">
                    {pending}
                  </span>
                ) : null}
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/15 text-gold-600 transition-luxury duration-200 group-hover:bg-gold-500/25">
                  <Icon size={20} />
                </span>
                <span className="text-xs font-medium text-navy-950 sm:text-sm">{label}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-navy-700/50">
          Your memories are reviewed before appearing on the public Memory Wall.
        </p>
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="rounded-2xl border border-gold-500/15 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setView("menu")}
          aria-label="Back"
          className={cn(
            "tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy-950/10 text-navy-700/60 transition-luxury duration-200 hover:border-gold-400 hover:text-navy-950",
          )}
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="font-display text-base text-navy-950">{VIEW_TITLES[view]}</h3>
      </div>

      <div className="mt-5">
        {view === "photo" ? <PhotoUpload upload={photoUpload} /> : null}
        {view === "video-record" ? <VideoUpload upload={videoUpload} initialMode="record" /> : null}
        {view === "video-upload" ? <VideoUpload upload={videoUpload} initialMode="upload" /> : null}
        {view === "audio-record" ? <AudioUpload upload={audioUpload} initialMode="record" /> : null}
        {view === "audio-upload" ? <AudioUpload upload={audioUpload} initialMode="upload" /> : null}
        {view === "note" ? <GuestbookForm token={token} /> : null}
      </div>

      <p className="mt-6 text-center text-xs text-navy-700/50">
        Your memories are reviewed before appearing on the public Memory Wall.
      </p>
    </div>
  );
}
