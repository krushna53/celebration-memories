"use client";

import { useEffect, useRef, useState } from "react";
import s from "./create.module.css";

const looks = { gold: "#ffe3a0", white: "#ffffff", ivory: "#fff5df", champagne: "#f7e1b5", blush: "#ffd6e0" };

function formatDate(value) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[3])}/${Number(match[2])}/${match[1]}`;
}
function formatTime(value) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** Browser-side final finishing: preview and export the provider MP4 with text, trim and optional music. */
export default function AiReelFinishing({ videoUrl, scenes }) {
  const video = useRef(null);
  const canvas = useRef(null);
  const audio = useRef(null);
  const [skip, setSkip] = useState(0.6);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [look, setLook] = useState("gold");
  const [placement, setPlacement] = useState("top");
  const [headingSize, setHeadingSize] = useState(48);
  const [addressSize, setAddressSize] = useState(28);
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [musicFile, setMusicFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const current = scenes[Math.min(sceneIndex, scenes.length - 1)] || {};

  useEffect(() => () => { if (musicUrl) URL.revokeObjectURL(musicUrl); }, [musicUrl]);
  useEffect(() => { draw(); }, [current, brideName, groomName, look, placement, headingSize, addressSize]); // redraw the canvas whenever a finishing choice changes
  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    const playMusic = () => { if (audio.current && musicUrl) { audio.current.currentTime = Math.max(0, v.currentTime - skip) % Math.max(1, audio.current.duration || 1); void audio.current.play().catch(() => {}); } };
    const pauseMusic = () => audio.current?.pause();
    v.addEventListener("play", playMusic); v.addEventListener("pause", pauseMusic); v.addEventListener("ended", pauseMusic);
    return () => { v.removeEventListener("play", playMusic); v.removeEventListener("pause", pauseMusic); v.removeEventListener("ended", pauseMusic); };
  }, [musicUrl, skip]);

  function sceneAt(time, duration) {
    if (!scenes.length) return {};
    const usable = Math.max(.25, duration - skip);
    const progress = Math.max(0, Math.min(.999, (time - skip) / usable));
    return scenes[Math.min(scenes.length - 1, Math.floor(progress * scenes.length))] || scenes[0];
  }
  function draw(source = video.current, time = video.current?.currentTime || skip, duration = video.current?.duration || 15) {
    const c = canvas.current;
    if (!c || !source || !(source.videoWidth || source.width)) return;
    const ctx = c.getContext("2d"); const sw = source.videoWidth || source.width; const sh = source.videoHeight || source.height;
    const scale = Math.max(c.width / sw, c.height / sh); const w = sw * scale; const h = sh * scale;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(source, (c.width - w) / 2, (c.height - h) / 2, w, h);
    const activeScene = sceneAt(time, duration);
    if (!activeScene.text) return;
    // Text is intentionally always kept at the top: one predictable position
    // avoids clashes with the couple and keeps every scene easy to read.
    if (placement === "bottom") {
      // A compact card keeps the lower text legible without covering the
      // couple's faces or making half the scene look dark.
      const cardTop = 930;
      ctx.save(); ctx.fillStyle = "rgba(25,14,29,.84)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(38, cardTop, 644, 290, 26); else ctx.rect(38, cardTop, 644, 290);
      ctx.fill(); ctx.strokeStyle = "rgba(255,227,160,.45)"; ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(50, cardTop + 12, 620, 266, 18); else ctx.rect(50, cardTop + 12, 620, 266);
      ctx.stroke(); ctx.restore();
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, 360);
      gradient.addColorStop(0, "rgba(20,11,25,.72)"); gradient.addColorStop(1, "rgba(20,11,25,0)");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, c.width, 360);
    }
    ctx.textAlign = "center"; ctx.fillStyle = looks[look]; ctx.shadowColor = "#000"; ctx.shadowBlur = 8;
    const y = placement === "bottom" ? 1005 : 120;
    ctx.font = `700 ${headingSize}px Georgia`; ctx.fillText(activeScene.text, 360, y, 620);
    const names = [brideName, groomName].filter(Boolean).join(" & ");
    if (names) { ctx.font = `${Math.round(headingSize * .6)}px Georgia`; ctx.fillText(names, 360, y + headingSize * 1.18, 620); }
    const dateTime = [formatDate(activeScene.date), formatTime(activeScene.time)].filter(Boolean).join(" · ");
    const textOffset = names ? headingSize * 1.2 : 0;
    ctx.font = `${Math.round(headingSize * .58)}px Georgia`; if (dateTime) ctx.fillText(dateTime, 360, y + headingSize * 1.25 + textOffset, 620);
    ctx.font = `${addressSize}px Georgia`; if (activeScene.venue) ctx.fillText(activeScene.venue, 360, y + headingSize * 1.25 + textOffset + addressSize * 1.45, 630);
  }
  function onVideoReady() { if (video.current) { video.current.currentTime = skip; draw(); } }
  function onTime() {
    const v = video.current; if (!v) return;
    const usable = Math.max(.25, v.duration - skip);
    const next = Math.min(scenes.length - 1, Math.max(0, Math.floor(Math.max(0, v.currentTime - skip) / usable * scenes.length)));
    setSceneIndex(next); draw(v, v.currentTime, v.duration);
  }
  function changeSkip(value) { const number = Math.max(0, Number(value) || 0); setSkip(number); if (video.current) { video.current.currentTime = number; setSceneIndex(0); draw(video.current, number, video.current.duration); } }
  function chooseMusic(event) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!file.type.startsWith("audio/")) { setError("Choose an audio file such as MP3, M4A or WAV."); return; } if (musicUrl) URL.revokeObjectURL(musicUrl); setMusicFile(file); setMusicUrl(URL.createObjectURL(file)); setError(""); }
  function playOrPause() { if (!video.current) return; if (video.current.paused) void video.current.play(); else video.current.pause(); }
  async function exportReel() {
    if (!videoUrl || !canvas.current) return;
    setExporting(true); setError(""); setMessage("");
    let input; let output;
    try {
      const media = await import("mediabunny");
      const response = await fetch(videoUrl); if (!response.ok) throw new Error("The generated video link is no longer available. Download it before it expires.");
      const blob = await response.blob();
      const codec = await media.getFirstEncodableVideoCodec(["avc"], { width: 720, height: 1280, frameRate: 24 });
      if (!codec) throw new Error("MP4 export needs current Chrome or Edge.");
      output = new media.Output({ format: new media.Mp4OutputFormat({ fastStart: "in-memory" }), target: new media.BufferTarget() });
      const videoSource = new media.CanvasSource(canvas.current, { codec, bitrate: 2_000_000 }); output.addVideoTrack(videoSource, { frameRate: 24 });
      input = new media.Input({ formats: media.ALL_FORMATS, source: new media.BlobSource(blob) });
      const track = await input.getPrimaryVideoTrack(); if (!track || !await track.canDecode()) throw new Error("This MP4 cannot be edited in this browser.");
      const duration = await track.computeDuration(); const end = Math.max(skip + .25, duration); const total = end - skip;
      let audioSource;
      if (musicFile) {
        const context = new AudioContext(); const buffer = await context.decodeAudioData(await musicFile.arrayBuffer());
        const audioCodec = await media.getFirstEncodableAudioCodec(["aac"], { numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
        if (audioCodec) { audioSource = new media.AudioBufferSource({ codec: audioCodec, bitrate: 128000 }); output.addAudioTrack(audioSource); await output.start(); await audioSource.add(buffer); await context.close(); }
      }
      if (!audioSource) await output.start();
      const sink = new media.CanvasSink(track, { poolSize: 2 }); const frames = Math.ceil(total * 24); const stamps = Array.from({ length: frames }, (_, i) => Math.min(skip + i / 24, duration - .001));
      let i = 0; for await (const frame of sink.canvasesAtTimestamps(stamps)) { if (!frame) throw new Error("A video frame could not be read."); draw(frame.canvas, stamps[i], duration); await videoSource.add(i / 24, 1 / 24); i += 1; }
      videoSource.close(); audioSource?.close(); await output.finalize();
      const file = new File([output.target.buffer], "animated-wedding-reel.mp4", { type: "video/mp4" }); const href = URL.createObjectURL(file); const link = document.createElement("a"); link.href = href; link.download = file.name; link.click(); URL.revokeObjectURL(href);
      setMessage("Your edited 9:16 MP4 is downloading now.");
    } catch (e) { await output?.cancel?.().catch(() => {}); setError(e.message || "The reel could not be exported."); }
    finally { input?.dispose?.(); setExporting(false); }
  }

  return <section className={s.aiFinish} aria-label="Finish your reel">
    <h3>Finish your reel</h3><p>These edits are free on this device. They are included in the downloaded MP4.</p>
    <div className={s.aiFinishGrid}>
      <div><canvas ref={canvas} width="720" height="1280" className={s.aiReelCanvas} />
        <video ref={video} src={videoUrl} playsInline className={s.aiSourceVideo} onLoadedData={onVideoReady} onTimeUpdate={onTime} />
        <div className={s.aiPreviewActions}><button type="button" onClick={playOrPause}>Play / pause preview</button><button type="button" onClick={() => { if (video.current) { video.current.currentTime = skip; draw(); } }}>Restart after skip</button></div></div>
      <div className={s.aiFinishControls}>
        <div className={s.aiTwoCol}><label>Bride name<input value={brideName} onChange={(e) => setBrideName(e.target.value)} placeholder="Bride name" /></label><label>Groom name<input value={groomName} onChange={(e) => setGroomName(e.target.value)} placeholder="Groom name" /></label></div>
        <p className={s.aiActiveScene}>Now showing: <strong>{current.text || current.title || "Scene"}</strong>. Ceremony text, date, time and venue come from the ceremony details above.</p>
        <label>Text placement<select value={placement} onChange={(e) => setPlacement(e.target.value)}><option value="top">Place text at top</option><option value="bottom">Place text at bottom</option></select></label>
        <small>Text stays at the top of every scene, so it does not cover the couple.</small>
        <label>Lettering colour<select value={look} onChange={(e) => { setLook(e.target.value); setTimeout(draw, 0); }}><option value="gold">Elegant gold</option><option value="white">Classic white</option><option value="ivory">Soft ivory</option><option value="champagne">Champagne</option><option value="blush">Blush pink</option></select></label>
        <label>Heading size<select value={headingSize} onChange={(e) => { setHeadingSize(Number(e.target.value)); setTimeout(draw, 0); }}><option value="40">Small</option><option value="48">Regular</option><option value="58">Large</option><option value="68">Extra large</option></select></label>
        <label>Address size<select value={addressSize} onChange={(e) => { setAddressSize(Number(e.target.value)); setTimeout(draw, 0); }}><option value="24">Small</option><option value="28">Regular</option><option value="34">Large</option><option value="40">Extra large</option></select></label>
        <label>Skip front opening (seconds)<input type="number" min="0" max="8" step="0.1" value={skip} onChange={(e) => changeSkip(e.target.value)} /></label><small>Default skips 0.6 seconds so the reference-photo opening is removed. Set 0 to keep it.</small>
        <label className={s.aiMusicUpload}><span>♫ Add your song</span><input type="file" accept="audio/*" onChange={chooseMusic} /><em>{musicFile ? musicFile.name : "Choose MP3, M4A or WAV"}</em></label>{musicFile && <button type="button" onClick={() => { if (musicUrl) URL.revokeObjectURL(musicUrl); setMusicUrl(""); setMusicFile(null); }}>Remove song</button>}
        <button type="button" className={s.aiPrimary} disabled={exporting} onClick={() => void exportReel()}>{exporting ? "Making your reel…" : "Download reel (MP4, 9:16 HD)"}</button>
        {message && <p className={s.hint}>{message}</p>}{error && <p className={s.error}>{error}</p>}
      </div>
    </div>
  </section>;
}
