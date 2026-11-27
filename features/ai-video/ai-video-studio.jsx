"use client";
// AI wedding video studio — the "Upload my own · AI video" / "Create your own story" reel maker
// ported from the Krushna 53 invitation studio (app/reels/create in AI mode).
// Left: settings, ceremony scenes and music. Right: the phone preview + on-device reel finishing,
// rendered by AiVideoSetup into the preview column through a portal.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AiVideoSetup from "@/features/ai-video/components/AiVideoSetup";
import AiVideoTour from "@/features/ai-video/components/AiVideoTour";
import { DRAFT_KEY, Segmented, readSavedDetails } from "@/features/ai-video/components/ui-helpers";
import { generateMusic, prepareUploadedMusic } from "@/features/ai-video/lib/music";
import "./ai-video.css";

const DEMO_DETAILS = {
  title: "Wedding Ceremony",
  hostLine: "Together with their families",
  blessing: "॥ श्री गणेशाय नमः ॥",
  brideName: "Aarohi",
  groomName: "Reyansh",
  date: "2026-12-20",
  time: "16:30",
  venue: "The Gulmohar Palace",
  city: "Jaipur, Rajasthan",
  message: "Request the honour of your presence as we take our pheras.",
};

/** Default event schedule around the wedding date (used for the reel's ceremony lettering). */
function defaultJourney(kinds, weddingDate, venue) {
  const offsets = { haldi: [-2, "10:00"], mehndi: [-1, "16:00"], sangeet: [-1, "20:00"], engagement: [-30, "18:00"], wedding: [0, "16:30"], reception: [1, "19:30"] };
  const base = new Date((weddingDate || "2026-12-20") + "T12:00:00");
  return kinds.map((kind) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offsets[kind][0]);
    return { kind, date: d.toISOString().slice(0, 10), time: offsets[kind][1], venue };
  });
}
const JOURNEY = ["haldi", "mehndi", "sangeet", "wedding", "reception"];
const MUSIC_SECONDS = 16;

/**
 * embedded: inside /ai-reel's "Create AI video" tab (wedding ceremonies only).
 * storyOnly: the love story editor (/wedding/stories/create): story mode only, opening ?from=<story id> for editing.
 */
export function AiVideoStudio({ embedded = false, storyOnly = false } = {}) {
  const [previewHost, setPreviewHost] = useState(null);
  const [source, setSource] = useState(storyOnly ? "story" : "ai");
  const [details, setDetails] = useState(DEMO_DETAILS);
  const [events, setEvents] = useState(() => defaultJourney(JOURNEY, DEMO_DETAILS.date, DEMO_DETAILS.venue));
  const [musicChoice, setMusicChoice] = useState("auto");
  const [songFile, setSongFile] = useState(null);
  const [songOffset, setSongOffset] = useState(0);
  // Optional end of the uploaded song (seconds); the segment then repeats from the start offset for longer reels.
  const [songEnd, setSongEnd] = useState(0);
  const [music, setMusic] = useState(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("source");
    if (wanted === "story") setSource("story");
    const saved = readSavedDetails();
    if (saved?.brideName) {
      const base = { ...DEMO_DETAILS, ...saved };
      setDetails(base);
      setEvents(defaultJourney(JOURNEY, base.date, base.venue));
    }
  }, []);

  // Remember names/date/venue in this browser for the next visit.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ details: { brideName: details.brideName, groomName: details.groomName, date: details.date, time: details.time, venue: details.venue, city: details.city } }));
      } catch { /* storage blocked */ }
    }, 800);
    return () => clearTimeout(id);
  }, [details.brideName, details.groomName, details.date, details.time, details.venue, details.city]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (musicChoice === "none") return setMusic(null);
        if (musicChoice === "upload") {
          if (!songFile) return setMusic(null);
          const buf = await prepareUploadedMusic(songFile, songOffset, songEnd > songOffset ? songEnd - songOffset : null);
          if (alive) setMusic(buf);
          return;
        }
        const buf = await generateMusic(musicChoice === "auto" ? "festive" : musicChoice, MUSIC_SECONDS);
        if (alive) setMusic(buf);
      } catch {
        if (alive) setMusic(null);
      }
    })();
    return () => { alive = false; };
  }, [musicChoice, songFile, songOffset, songEnd]);

  function restoreReel(saved) {
    if (saved?.details) setDetails(saved.details);
    if (saved?.sharedEvents) setEvents(saved.sharedEvents);
    if (saved?.musicSettings) {
      setMusicChoice(saved.musicSettings.choice || "none");
      setSongOffset(saved.musicSettings.offset || 0);
      setSongEnd(saved.musicSettings.end || 0);
      setSongFile(saved.musicSettings.file || null);
    }
  }

  return (
    <div className={`ai-video-root ai-reel-page${embedded ? " ai-video-embedded" : ""}`}>
      {storyOnly && <section className="hero compact">
        <p className="eyebrow">LOVE STORY REEL</p>
        <h1>Customize your <em>story.</em></h1>
        <p>Your chosen story video opens below with its scenes, names, places and dates ready to edit. Change any text on the video, add music, then download a 9:16 MP4 for WhatsApp and Instagram. Editing the text uses no credits.</p>
      </section>}
      {!embedded && !storyOnly && <section className="hero compact">
        <p className="eyebrow">AI WEDDING VIDEO</p>
        <h1>Your photo, <em>in motion.</em></h1>
        <p>Upload your couple photo, plan each ceremony scene and review the credits before anything is generated. Finish the reel with names, dates and venues on this device and download a 9:16 MP4 for WhatsApp and Instagram.</p>
      </section>}

      {!embedded && !storyOnly && <section className="reel-source-picker" aria-label="Choose how to create your reel">
        <Segmented label="Reel source" value={source} onChange={setSource} options={[{ id: "ai", label: "Upload my own · AI video" }, { id: "story", label: "Create your own story" }]} />
      </section>}

      <div className="studio-grid">
        <div className="studio-form">
          {embedded && <header className="ai-embedded-head">
            <div className="ai-embedded-head-row">
              <p className="ai-embedded-eyebrow">Animated wedding film</p>
              <AiVideoTour />
            </div>
            <h2>Create your reel</h2>
          </header>}
          <AiVideoSetup
            mode={embedded || source !== "story" ? "wedding" : "story"}
            onModeChange={(mode) => setSource(mode === "story" ? "story" : "ai")}
            onRestoreReel={restoreReel}
            editorProps={{ details, events, music, musicSettings: { choice: musicChoice, offset: songOffset, end: songEnd, file: songFile } }}
            renderEditor={(editor) => (previewHost ? createPortal(editor, previewHost) : null)}
            hideSaved={embedded}
            topFields={
              <section className="ai-names-card" data-tour="ai-names">
                <h3>Wedding invitation details</h3>
                <p className="hint small">Enter only the names you want displayed in your invitation.</p>
                <div className="ai-names-grid">
                  <label>Bride name<input maxLength={40} value={details.brideName} onChange={(e) => setDetails((d) => ({ ...d, brideName: e.target.value }))} /></label>
                  <label>Groom name<input maxLength={40} value={details.groomName} onChange={(e) => setDetails((d) => ({ ...d, groomName: e.target.value }))} /></label>
                </div>
              </section>
            }
          />

          <section className="step" data-tour="ai-music">
            <header><span className="num">04</span><div><small>SOUNDTRACK</small><h2>Music</h2></div></header>
            <Segmented label="Music" value={musicChoice} onChange={setMusicChoice} options={[{ id: "auto", label: "Auto" }, { id: "calm", label: "Soft santoor" }, { id: "festive", label: "Festive dhol" }, { id: "upload", label: "My song" }, { id: "none", label: "No music" }]} />
            {musicChoice === "upload" && (
              <div className="fields two">
                <label className="field">SONG FILE (MP3/M4A)<input type="file" accept="audio/*" onChange={(e) => setSongFile(e.target.files?.[0] ?? null)} /></label>
                <label className="field">START FROM (SECONDS)<input type="number" min={0} max={600} value={songOffset} onChange={(e) => setSongOffset(Number(e.target.value) || 0)} /></label>
                <label className="field">END AT (SECONDS, OPTIONAL)<input type="number" min={0} max={900} step="0.1" value={songEnd || ""} placeholder="e.g. 67 for 1:07" onChange={(e) => setSongEnd(Number(e.target.value) || 0)} /></label>
              </div>
            )}
            <p className="hint small">Selected music replaces the original AI video audio in the phone preview and downloaded reel. Tap Sound on to listen. Audio changes use no API credits; Open / save generated MP4 keeps the original provider audio.</p>
            <p className="hint small">Built-in music is generated in your browser and free to use. Only upload songs you have the rights to share.</p>
          </section>
        </div>

        <aside className="studio-preview ai-preview" data-tour="ai-preview">
          <div className="preview-sticky">
            <div ref={setPreviewHost} />
          </div>
        </aside>
      </div>
    </div>
  );
}
