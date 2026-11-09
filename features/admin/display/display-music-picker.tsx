"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Music, Pause, Play, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { REEL_MUSIC } from "@/lib/reel-music";
import { trackKey, trackLabel, type DisplayTrack } from "@/lib/display-music";
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
  initialTracks: DisplayTrack[];
}

/** Saves the ordered playlist used by the Big Screen Display. */
export function DisplayMusicPicker({ eventId, initialTracks }: DisplayMusicPickerProps) {
  const [tracks, setTracks] = useState(initialTracks);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function save(next: DisplayTrack[]) {
    setBusy("Saving…");
    setError(null);
    try {
      const result = await setDisplayMusicAction(eventId, next);
      if (!result.success) throw new Error(result.error);
      setTracks(next);
    } catch (err) {
      setError(staleDeployMessage(err) ?? (err instanceof Error ? err.message : "Failed to save music."));
    } finally {
      setBusy(null);
    }
  }

  function togglePreset(choice: typeof PRESETS[number]) {
    const exists = tracks.some((track) => track.choice === choice);
    void save(exists ? tracks.filter((track) => track.choice !== choice) : [...tracks, { choice, path: null }]);
  }

  function move(index: number, offset: number) {
    const destination = index + offset;
    if (destination < 0 || destination >= tracks.length) return;
    const next = [...tracks];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    void save(next);
  }

  function preview(key: typeof PRESETS[number]) {
    audioRef.current?.pause();
    if (previewing === key) { setPreviewing(null); return; }
    const audio = new Audio(REEL_MUSIC[key].url);
    audio.volume = 0.6;
    audio.onended = () => setPreviewing(null);
    void audio.play().catch(() => setPreviewing(null));
    audioRef.current = audio;
    setPreviewing(key);
  }

  async function upload(file: File) {
    if (tracks.length >= 20) return;
    setBusy("Uploading…");
    setError(null);
    try {
      const type = normalizeAudioType(file);
      const signed = await requestDisplayMusicUploadAction(eventId, file.name, type, file.size);
      if (!signed.success) throw new Error(signed.error);
      const { error: uploadError } = await supabaseBrowser().storage.from(signed.data.bucket)
        .uploadToSignedUrl(signed.data.path, signed.data.token, file, { contentType: type });
      if (uploadError) throw new Error(uploadError.message);
      await save([...tracks, { choice: "custom", path: signed.data.path }]);
    } catch (err) {
      setError(staleDeployMessage(err) ?? (err instanceof Error ? err.message : "Upload failed."));
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="display-music-heading" className="rounded-xl border border-navy-950/10 bg-white p-4">
      <h2 id="display-music-heading" className="flex items-center gap-2 font-display text-lg text-navy-950">
        <Music size={17} className="text-gold-600" /> Big Screen music
      </h2>
      <p className="mt-1 text-xs text-navy-700/60">
        Choose up to 20 songs. They play in order and repeat after you tap Start on the Big Screen Display,
        softening while a guest&rsquo;s video or voice message plays. Changes save automatically.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {PRESETS.map((key) => {
          const selected = tracks.some((track) => track.choice === key);
          return <li key={key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${selected ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10"}`}>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-navy-950">
              <input type="checkbox" className="accent-gold-600" checked={selected} disabled={busy !== null || (!selected && tracks.length >= 20)} onChange={() => togglePreset(key)} />
              <span className="truncate">{REEL_MUSIC[key].label}</span>
            </label>
            <button type="button" onClick={() => preview(key)} aria-label={previewing === key ? "Stop preview" : `Preview ${REEL_MUSIC[key].label}`} className="tap-target text-gold-700">
              {previewing === key ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </li>;
        })}
      </ul>
      {tracks.length ? <ol aria-label="Song order" className="mt-4 space-y-2">
        {tracks.map((track, index) => <li key={trackKey(track)} className="flex items-center gap-2 text-sm text-navy-950">
          <span className="min-w-0 flex-1 truncate">{index + 1}. {trackLabel(track)}</span>
          <button type="button" disabled={busy !== null || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${trackLabel(track)} up`} className="tap-target disabled:opacity-30"><ArrowUp size={16} /></button>
          <button type="button" disabled={busy !== null || index === tracks.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${trackLabel(track)} down`} className="tap-target disabled:opacity-30"><ArrowDown size={16} /></button>
          <button type="button" disabled={busy !== null} onClick={() => void save(tracks.filter((_, i) => i !== index))} aria-label={`Remove ${trackLabel(track)}`} className="tap-target disabled:opacity-30"><X size={16} /></button>
        </li>)}
      </ol> : <p className="mt-4 text-sm text-navy-700/60">No background music selected.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-m4a,.mp3,.m4a,.aac,.wav" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (file) void upload(file);
        }} />
        <Button type="button" size="sm" variant="outline" disabled={busy !== null || tracks.length >= 20} onClick={() => fileRef.current?.click()}>
          {busy === "Uploading…" ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />} Add your own song
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy !== null || tracks.length === 0} onClick={() => void save([])}>No music</Button>
        <span className="text-xs text-navy-700/60">MP3, M4A, AAC or WAV, up to 25MB per song</span>
      </div>
      {busy ? <p className="mt-2 text-xs text-navy-700/60" role="status">{busy}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
    </section>
  );
}
