"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Circle,
  FileAudio,
  FileVideo,
  ImagePlus,
  Loader2,
  Mic,
  PenLine,
  UploadCloud,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMediaUpload } from "@/hooks/use-media-upload";
import { PhotoUpload } from "@/features/uploads/components/photo-upload";
import { VideoUpload } from "@/features/uploads/components/video-upload";
import { AudioUpload } from "@/features/uploads/components/audio-upload";
import { GuestbookForm } from "@/features/guestbook/guestbook-form";

interface MediaUploadsSectionProps {
  token: string;
  /** Skips straight to this view instead of landing on the menu first — used by PublicMemoryUploader, which folds its own name field and this menu into one screen, so by the time this component mounts the guest has already picked an action. */
  initialView?: View;
  /** Off for the public "share a memory" page (see PublicMemoryUploader) — keeps that flow to the fewest possible fields for a guest who's just dropping off a quick photo/video/audio. Defaults to true (shown), which is what the personal /invite/[token] page still uses. */
  showCaption?: boolean;
}

export type View = "menu" | "photo" | "video-record" | "video-upload" | "audio-record" | "audio-upload" | "note";

export interface ActionOption {
  view: View;
  label: string;
  icon: typeof ImagePlus;
  /** Small red-dot badge for the two "record" actions, so they read as distinct from their upload counterparts at a glance. */
  isRecordAction?: boolean;
}

// Audio actions are placed last, away from Record Video — sitting
// right next to each other, "Record Video" and "Record Audio" read as
// easy to mix up at a glance (same icon style, same red "record" dot).
// Grouping both audio options at the end of the grid keeps the video
// pair visually distinct from the audio pair.
export const ACTIONS: ActionOption[] = [
  { view: "video-record", label: "Record Video", icon: Video, isRecordAction: true },
  { view: "photo", label: "Upload Image", icon: ImagePlus },
  { view: "video-upload", label: "Upload Video", icon: FileVideo },
  { view: "note", label: "Add a Text Message", icon: PenLine },
  { view: "audio-record", label: "Record Audio", icon: Mic, isRecordAction: true },
  { view: "audio-upload", label: "Upload Audio", icon: FileAudio },
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
export function MediaUploadsSection({ token, initialView = "menu", showCaption = true }: MediaUploadsSectionProps) {
  const [view, setView] = useState<View>(initialView);
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

  // Total items recorded/picked but not yet successfully uploaded, across
  // all three kinds regardless of which view is currently showing — a
  // guest who records a video, backs out to the menu, and never taps
  // Upload All still has something at risk of being lost.
  const pendingUploadCount =
    photoUpload.items.filter((it) => it.status !== "done").length +
    videoUpload.items.filter((it) => it.status !== "done").length +
    audioUpload.items.filter((it) => it.status !== "done").length;

  // Recording is live but not yet stopped, so there's no queued item at
  // all yet — still needs guarding, just with different modal copy/
  // buttons than "you have N unsaved items" (see leaveConfirmModal).
  const [videoRecording, setVideoRecording] = useState(false);
  const [audioRecording, setAudioRecording] = useState(false);
  const isRecordingLive = videoRecording || audioRecording;

  const hasPendingUploads = pendingUploadCount > 0 || isRecordingLive;

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [savingFromGuard, setSavingFromGuard] = useState(false);
  // True for exactly the one popstate we trigger ourselves when the
  // guest actually confirms "Leave without saving" — lets the handler
  // tell "the guest pressed back again for real" apart from "our own
  // history.back() call to let that navigation through unintercepted."
  const leavingRef = useRef(false);

  // Traps the mobile/browser back button while an unsaved recording or
  // pick sits in the queue: pushes a same-URL decoy history entry, and
  // when a back gesture pops it, re-shows this dialog instead of
  // silently leaving with the memory never uploaded — a senior guest is
  // exactly the person likely to hit the phone's back button rather
  // than look for an in-page "cancel" affordance. Re-arms itself (pushes
  // a fresh decoy) every time the guest chooses to stay, so it keeps
  // catching back attempts until the queue is actually empty.
  useEffect(() => {
    if (!hasPendingUploads) return;

    window.history.pushState({ mediaUploadGuard: true }, "");

    function handlePopState() {
      if (leavingRef.current) {
        leavingRef.current = false;
        return;
      }
      setShowLeaveConfirm(true);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // Re-runs (and re-pushes a fresh decoy) whenever pendingUploadCount
    // changes — including right after "Keep Editing" or a completed
    // "Upload Now" — not just when hasPendingUploads first flips true.
  }, [hasPendingUploads, pendingUploadCount]);

  // Covers actually closing the tab / hard refresh / typing a new URL —
  // browsers show their own generic prompt here rather than this app's
  // dialog (custom text isn't permitted for beforeunload by any modern
  // browser), but it's the only hook available for those cases.
  useEffect(() => {
    if (!hasPendingUploads) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingUploads]);

  function handleKeepEditing() {
    setShowLeaveConfirm(false);
  }

  async function handleUploadNowFromGuard() {
    setSavingFromGuard(true);
    try {
      await Promise.all([photoUpload.uploadAll(), videoUpload.uploadAll(), audioUpload.uploadAll()]);
    } finally {
      setSavingFromGuard(false);
      setShowLeaveConfirm(false);
    }
  }

  function handleLeaveAnyway() {
    setShowLeaveConfirm(false);
    leavingRef.current = true;
    window.history.back();
  }

  // Still actively recording with nothing queued yet needs different
  // copy/buttons than "you have N unsaved items" — there's nothing to
  // "Upload Now" until the guest stops, so that button doesn't apply.
  const leaveConfirmModal = showLeaveConfirm ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
          <AlertTriangle size={22} />
        </div>
        <h3 className="mt-4 font-display text-lg text-navy-950">
          {pendingUploadCount > 0 ? "Save your memory first?" : "Still recording…"}
        </h3>
        <p className="mt-2 text-sm text-navy-700/70">
          {pendingUploadCount > 0 ? (
            <>
              You have {pendingUploadCount} {pendingUploadCount === 1 ? "item" : "items"} that{" "}
              {pendingUploadCount === 1 ? "hasn't" : "haven't"} been uploaded yet. Leaving now will lose{" "}
              {pendingUploadCount === 1 ? "it" : "them"}.
            </>
          ) : (
            "Your recording is still going. Leaving now will lose it — go back and tap Stop first to keep it."
          )}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {pendingUploadCount > 0 ? (
            <Button onClick={handleUploadNowFromGuard} disabled={savingFromGuard} className="w-full">
              {savingFromGuard ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
              Upload Now
            </Button>
          ) : null}
          <button
            type="button"
            onClick={handleKeepEditing}
            disabled={savingFromGuard}
            className="tap-target text-xs font-medium text-navy-700/60 hover:text-navy-950"
          >
            {pendingUploadCount > 0 ? "Keep Editing" : "Keep Recording"}
          </button>
          <button
            type="button"
            onClick={handleLeaveAnyway}
            disabled={savingFromGuard}
            className="tap-target text-xs font-medium text-navy-700/40 hover:text-red-600"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  ) : null;

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

        {leaveConfirmModal}
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
        {view === "photo" ? <PhotoUpload upload={photoUpload} showCaption={showCaption} /> : null}
        {view === "video-record" ? (
          <VideoUpload
            upload={videoUpload}
            initialMode="record"
            showCaption={showCaption}
            onRecordingChange={setVideoRecording}
          />
        ) : null}
        {view === "video-upload" ? (
          <VideoUpload
            upload={videoUpload}
            initialMode="upload"
            showCaption={showCaption}
            onRecordingChange={setVideoRecording}
          />
        ) : null}
        {view === "audio-record" ? (
          <AudioUpload
            upload={audioUpload}
            initialMode="record"
            showCaption={showCaption}
            onRecordingChange={setAudioRecording}
          />
        ) : null}
        {view === "audio-upload" ? (
          <AudioUpload
            upload={audioUpload}
            initialMode="upload"
            showCaption={showCaption}
            onRecordingChange={setAudioRecording}
          />
        ) : null}
        {view === "note" ? <GuestbookForm token={token} /> : null}
      </div>

      <p className="mt-6 text-center text-xs text-navy-700/50">
        Your memories are reviewed before appearing on the public Memory Wall.
      </p>

      {leaveConfirmModal}
    </div>
  );
}
