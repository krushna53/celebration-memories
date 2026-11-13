"use client";

import { useEffect, useMemo, useState } from "react";
import s from "./create.module.css";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const WEDDING_SCENES = [
  { title: "Mehendi", description: "Mehendi is being drawn on her palms while family smile in a flower-filled courtyard.", venue: "", brideOutfit: "Green floral lehenga", groomOutfit: "Light green kurta" },
  { title: "Haldi", description: "Family gently apply haldi with marigolds, laughter and a warm yellow celebration.", venue: "", brideOutfit: "Yellow saree with flower jewellery", groomOutfit: "White kurta-pyjama" },
  { title: "Wedding", description: "The couple meet beneath a floral mandap and exchange warm, emotional smiles.", venue: "", brideOutfit: "Traditional wedding saree or lehenga", groomOutfit: "Traditional sherwani" },
];

const JOURNEY_SCENES = [
  { title: "How we met", description: "They meet for the first time, exchange a shy smile and the moment becomes warm and easy.", venue: "", brideOutfit: "Smart casual outfit", groomOutfit: "Smart casual outfit" },
  { title: "A favourite memory", description: "They share a relaxed, joyful moment together with natural laughter and soft eye contact.", venue: "", brideOutfit: "Elegant day outfit", groomOutfit: "Elegant day outfit" },
  { title: "The proposal", description: "A romantic proposal moment with happy surprise, warm smiles and a gentle camera pullback.", venue: "", brideOutfit: "Evening outfit", groomOutfit: "Evening outfit" },
];

function cloneScenes(scenes) { return scenes.map((scene) => ({ ...scene })); }

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The photo could not be read. Please choose another image."));
    reader.readAsDataURL(file);
  });
}

function SceneEditor({ scene, index, onChange, onRemove, canRemove, journey }) {
  const set = (field, value) => onChange(index, { ...scene, [field]: value });
  return <article className={s.aiScene}>
    <div className={s.aiSceneTitle}><strong>Scene {index + 1}</strong>{canRemove && <button type="button" onClick={() => onRemove(index)}>Remove</button>}</div>
    <label className={s.label}><span>{journey ? "Moment" : "Ceremony"}</span><input className={s.input} value={scene.title} onChange={(e) => set("title", e.target.value)} /></label>
    <label className={s.label}><span>What happens in this scene?</span><textarea className={s.input} rows={3} value={scene.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe one clear moment" /></label>
    <label className={s.label}><span>Location (optional)</span><input className={s.input} value={scene.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Courtyard, beach, venue…" /></label>
    <div className={s.aiTwoCol}>
      <label className={s.label}><span>Bride outfit</span><input className={s.input} value={scene.brideOutfit} onChange={(e) => set("brideOutfit", e.target.value)} /></label>
      <label className={s.label}><span>Groom outfit</span><input className={s.input} value={scene.groomOutfit} onChange={(e) => set("groomOutfit", e.target.value)} /></label>
    </div>
  </article>;
}

export default function AiWeddingVideoStudio() {
  const [tab, setTab] = useState("own");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [weddingStyle, setWeddingStyle] = useState("Marathi wedding");
  const [scenes, setScenes] = useState(() => cloneScenes(WEDDING_SCENES));
  const [journeyScenes, setJourneyScenes] = useState(() => cloneScenes(JOURNEY_SCENES));
  const [resolution, setResolution] = useState("720p");
  const [duration, setDuration] = useState("15");
  const [direction, setDirection] = useState("Stylized 3D animation with illustrated faces that preserve the couple's likeness, warm cinematic lighting, natural silent expressions and smooth camera movement.");
  const [config, setConfig] = useState({ ready: false, message: "Checking local video setup…" });
  const [quote, setQuote] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const activeScenes = tab === "own" ? scenes : journeyScenes;
  const estimated = useMemo(() => ((Number(duration) * (resolution === "720p" ? 0.03 : 0.02)) + 0.01).toFixed(2), [duration, resolution]);

  useEffect(() => {
    fetch("/api/ai-reel/config").then((r) => r.json()).then(setConfig).catch(() => setConfig({ ready: false, message: "Could not check the AI video setup." }));
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!result?.id || result.status === "completed" || result.status === "failed") return undefined;
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/ai-reel/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: result.id }) });
        const next = await response.json();
        if (!response.ok) throw new Error(next.error || "Could not check video progress.");
        setResult(next);
        if (next.status === "completed") setStatus(`Your video is ready${next.actualCredits ? ` · actual provider usage: $${next.actualCredits}` : ""}.`);
        if (next.status === "failed") { setStatus(""); setError(next.error || "The video could not be generated."); }
      } catch (e) { setError(e.message); }
    }, 5000);
    return () => clearInterval(timer);
  }, [result?.id, result?.status]);

  const updateScenes = (which, index, value) => {
    const setter = which === "own" ? setScenes : setJourneyScenes;
    setter((old) => old.map((scene, i) => i === index ? value : scene));
    setQuote(null);
  };
  const removeScene = (which, index) => {
    const setter = which === "own" ? setScenes : setJourneyScenes;
    setter((old) => old.filter((_, i) => i !== index));
    setQuote(null);
  };
  const addScene = (which) => {
    const setter = which === "own" ? setScenes : setJourneyScenes;
    setter((old) => [...old, { title: which === "own" ? "Other ritual" : "Another memory", description: "Describe this moment in a few simple lines.", venue: "", brideOutfit: "", groomOutfit: "" }]);
    setQuote(null);
  };
  const pickPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) { setError("Choose a JPG, PNG or WebP photo under 3 MB."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file); setPreview(URL.createObjectURL(file)); setError(""); setQuote(null); setResult(null);
  };
  const requestQuote = async () => {
    setError(""); setStatus(""); setResult(null);
    if (!photo) { setError("Upload one couple photo before reviewing the generation."); return; }
    if (!activeScenes.length || activeScenes.some((scene) => !scene.title.trim() || !scene.description.trim())) { setError("Give every scene a title and a short description."); return; }
    try {
      const response = await fetch("/api/ai-reel/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: tab, style: weddingStyle, scenes: activeScenes, duration: Number(duration), resolution, direction }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare this video.");
      setQuote(data);
    } catch (e) { setError(e.message); }
  };
  const generate = async () => {
    if (!quote || !photo) return;
    setError(""); setStatus("Sending your confirmed video request…");
    try {
      const image = await toDataUrl(photo);
      const response = await fetch("/api/ai-reel/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: quote.token, image }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The video request could not start.");
      setResult(data); setStatus(data.status === "completed" ? "Your video is ready." : "Video generation has started. It can take a few minutes.");
    } catch (e) { setStatus(""); setError(e.message); }
  };

  return <section className={s.aiStudio} aria-labelledby="ai-video-title">
    <div className={s.aiStudioHead}><p>AI VIDEO</p><h2 id="ai-video-title">Create an animated video</h2><span>Make a short 9:16 invitation film after your design.</span></div>
    <div className={s.aiTabs} role="tablist">
      <button type="button" role="tab" aria-selected={tab === "own"} className={tab === "own" ? s.aiTabOn : ""} onClick={() => { setTab("own"); setQuote(null); }}>Upload my own</button>
      <button type="button" role="tab" aria-selected={tab === "journey"} className={tab === "journey" ? s.aiTabOn : ""} onClick={() => { setTab("journey"); setQuote(null); }}>Create your journey</button>
    </div>
    <p className={s.aiIntro}>{tab === "own" ? "Choose the rituals you want, edit each scene and turn one couple photo into an animated wedding reel." : "Tell your story in simple scenes. The video uses the same uploaded couple photo and turns each moment into an animated reel."}</p>

    <div className={s.aiPhotoRow}>
      <label className={s.fileBtn}>Upload couple photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickPhoto} /></label>
      {photo && <button type="button" className={s.linkBtn} onClick={() => { if (preview) URL.revokeObjectURL(preview); setPhoto(null); setPreview(""); setQuote(null); }}>Remove photo</button>}
      <span>{photo ? photo.name : "JPG, PNG or WebP · under 3 MB"}</span>
    </div>
    {preview && <img className={s.aiPhotoPreview} src={preview} alt="Uploaded couple preview" />}

    {tab === "own" && <label className={s.label}><span>Wedding style</span><select className={s.input} value={weddingStyle} onChange={(e) => { setWeddingStyle(e.target.value); setQuote(null); }}><option>Marathi wedding</option><option>Marwadi wedding</option><option>Bengali wedding</option><option>Gujarati wedding</option><option>South Indian wedding</option><option>Christian wedding</option><option>Sikh wedding</option><option>Muslim wedding</option></select></label>}
    <div className={s.aiScenes}>{activeScenes.map((scene, index) => <SceneEditor key={`${tab}-${index}`} scene={scene} index={index} journey={tab === "journey"} canRemove={activeScenes.length > 1} onChange={(i, value) => updateScenes(tab, i, value)} onRemove={(i) => removeScene(tab, i)} />)}</div>
    <button type="button" className={s.aiSmallButton} onClick={() => addScene(tab)}>+ Add {tab === "own" ? "a ceremony" : "a memory"}</button>

    <div className={s.aiTwoCol}>
      <label className={s.label}><span>Video length</span><select className={s.input} value={duration} onChange={(e) => { setDuration(e.target.value); setQuote(null); }}><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="15">15 seconds</option></select></label>
      <label className={s.label}><span>Export size</span><select className={s.input} value={resolution} onChange={(e) => { setResolution(e.target.value); setQuote(null); }}><option value="720p">Reel size · 720p</option><option value="480p">Smaller file · 480p</option></select></label>
    </div>
    <label className={s.label}><span>Animation direction</span><textarea className={s.input} rows={4} maxLength={1200} value={direction} onChange={(e) => { setDirection(e.target.value); setQuote(null); }} /></label>
    <div className={s.aiEstimate}><strong>Estimated credits used: ${estimated} USD credits</strong><span>This is an estimate, not the remaining balance. You will see a confirmation before any paid request.</span></div>
    {!config.ready && <p className={s.aiConfig}>{config.message || "Add XAI_API_KEY to this project's .env file to enable generation."}</p>}
    {!quote ? <button type="button" className={s.aiPrimary} onClick={requestQuote}>Review generation</button> : <div className={s.aiConfirm}><strong>${quote.estimate} estimated API credits</strong><span>{quote.summary}</span><button type="button" className={s.aiPrimary} disabled={!config.ready} onClick={generate}>Confirm and generate</button><button type="button" className={s.aiSmallButton} onClick={() => setQuote(null)}>Change details</button></div>}
    {status && <p className={s.hint} role="status">{status}</p>}
    {error && <p className={s.error}>{error}</p>}
    {result?.videoUrl && <div className={s.aiResult}><video controls playsInline src={result.videoUrl} /><a href={result.videoUrl} target="_blank" rel="noreferrer">Open / save generated MP4 →</a></div>}
  </section>;
}
