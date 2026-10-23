"use client";

import { useRef, useState } from "react";
import { Loader2, Music, Pause, Play, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { REEL_MUSIC } from "@/lib/reel-music";
import { staleDeployMessage } from "@/lib/stale-deploy";
import { supabaseBrowser } from "@/lib/supabase/client";
import { requestDisplayMusicUploadAction, setDisplayMusicAction } from "@/features/admin/display/display-music-actions";

const PRESETS = (Object.keys(REEL_MUSIC) as (keyof typeof REEL_MUSIC)[]).filter((k) => k !== "none");

/** Browsers report .m4a as audio/x-m4a; the audio bucket knows it as audio/mp4. */
function normalizeAudioType(file: File): string {
  const type = file.type.toLowerCase();
  if (type === "audio/x-m4a" || /\.m4a$/i.test(file.name)) return "audio/mp4";
  if (type === "audio/mp3" || (!type && /\.mp3$/i.test(file.name))) return "audio/mpeg";
  if (type === "audio/x-wav") return "audio/wav";
  return type;
}

interface DisplayMusicPickerProps {
  eventId: string;
  initialChoice: string;
  initialCustomName: string | null;
}

/**
 * Admin dashboard: background music for the Big Screen Display. Plays
 * after the "Start" tap on the display, loops, and fades down while a
 * guest video or voice message plays (features/display/display-music.tsx).
 */
export function DisplayMusicPicker({ eventId, initialChoice, initialCustomName }: DisplayMusicPickerProps) {
  const [choice, setChoice] = useState(initialChoice);
  const [customName, setCustomName] = useState(initialCustomName);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(next: string, path: string | null = null) {
    setBusy("Saving…");
    const result = await setDisplayMusicAction(eventId, next, path).catch((err: unknown) => ({
      success: false as const,
      error: staleDeployMessage(err) ?? "Failed.",
    }));
    setBusy(null);
    if (result.success) setChoice(next);
    else alert(result.error);
  }

  function preview(key: keyof typeof REEL_MUSIC) {
    audioRef.current?.pause();
    if (previewing === key) {
      setPreviewing(null);
      return;
    }
    const url = REEL_MUSIC[key].url;
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.onended = () => setPreviewing(null);
    void audio.play().catch(() => setPreviewing(null));
    audioRef.current = audio;
    setPreviewing(key);
  }

  async function upload(file: File) {
    setBusy("Uploading…");
    try {
      const type = normalizeAudioType(file);
      const signed = await requestDisplayMusicUploadAction(eventId, file.name, type, file.size);
      if (!signed.success) throw new Error(signed.error);
      const { error } = await supabaseBrowser()
        .storage.from(signed.data.bucket)
        .uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: type });
      if (error) throw new Error(error.message);
      setCustomName(file.name);
      await save("custom", signed.data.path);
    } catch (err) {
      alert(staleDeployMessage(err) ?? (err instanceof Error ? err.message : "Upload failed."));
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="display-music-heading" className="rounded-xl border border-navy-950/10 bg-white p-4">
      <h2 id="display-music-heading" className="flex items-center gap-2 font-display text-lg text-navy-950">
        <Music size={17} className="text-gold-600" /> Big Screen music
      </h2>
      <p className="mt-1 text-xs text-navy-700/60">
        Plays on the Big Screen Display after you tap Start, loops, and softens automatically while a guest&rsquo;s video or voice
        message plays.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {[...PRESETS, "none" as const].map((key) => (
          <li key={key}>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                choice === key ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10 hover:border-gold-500/40"
              }`}
            >
              <input
                type="radio"
                name="display-music"
                className="accent-gold-600"
                checked={choice === key}
                disabled={busy !== null}
                onChange={() => void save(key)}
              />
              <span className="min-w-0 flex-1 truncate text-navy-950">{REEL_MUSIC[key].label}</span>
              {key !== "none" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    preview(key);
                  }}
                  aria-label={previewing === key ? "Stop preview" : `Preview ${REEL_MUSIC[key].label}`}
                  className="tap-target flex items-center justify-center text-gold-700 hover:text-gold-600"
                >
                  {previewing === key ? <Pause size={14} /> : <Play size={14} />}
                </button>
              ) : null}
            </label>
          </li>
        ))}
        <li className="sm:col-span-2">
          <div
            className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              choice === "custom" ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10"
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-navy-950">
              {choice === "custom" && customName ? `Your song: ${customName}` : "Your own song (MP3, M4A, AAC or WAV, up to 25MB)"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-m4a,.mp3,.m4a,.aac,.wav"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
            <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
              {busy === "Uploading…" ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
              {choice === "custom" ? "Replace song" : "Upload a song"}
            </Button>
          </div>
        </li>
      </ul>
      {busy ? <p className="mt-2 text-xs text-navy-700/60" aria-live="polite">{busy}</p> : null}
    </section>
  );
}
