"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Film, ImagePlus, Music2, Pause, Play, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import TemplateReel from "./TemplateReel";
import { GHAR_CAPTIONS, REEL_TEMPLATES, TEMPLATE_EVENTS, reelTemplate } from "./reel-templates";

const STARTER_PROMPT = "Use the uploaded couple photo as identity reference. Create a vertical 9:16 stylized animated wedding film with expressive illustrated faces, warm cinematic light, elegant movement and a clear upper area for editable ceremony lettering. Keep the couple recognisable, avoid photorealistic photo reveals, no logos, watermark or spoken dialogue.";
const REEL_PRESETS = [
  { name: "Moonlit garden", prompt: "Create a romantic 9:16 animated wedding reel in a moonlit garden. Begin with a close view of dew-lit ivory flowers and lanterns, then reveal the illustrated couple walking through a floral arch. Use warm candle glow, slow camera movement, floating petals and a calm, editorial invitation-film feeling. Keep the upper third open for ceremony lettering. No logos, no spoken dialogue." },
  { name: "Heritage celebration", prompt: "Create a grand but elegant 9:16 animated Indian wedding reel. A carved heritage arch, marigold strings and lamp light frame the scene; the illustrated couple arrive together and share a natural smile. Move from a wide architectural reveal to one intimate wedding moment with soft gold light. Keep the upper third open for editable ceremony lettering. No logos, no spoken dialogue." },
  { name: "Modern love story", prompt: "Create a refined 9:16 stylized animated couple reel with a cinematic editorial look. Start on delicate paper textures and floral shadows, then reveal the couple in a warm, joyful celebration moment. Use subtle movement, expressive illustrated faces, soft depth and an elegant ending frame. Keep the upper third open for editable ceremony lettering. No logos, no spoken dialogue." },
];
type TextPosition = "top" | "bottom";
type EditorState = { bride: string; groom: string; ceremony: string; date: string; time: string; venue: string; family: string; colour: "ivory" | "gold" | "ink"; size: "regular" | "large"; position: TextPosition };
const DEFAULTS: EditorState = { bride: "Aarohi", groom: "Reyansh", ceremony: "Wedding Ceremony", date: "Saturday, 14 February 2027", time: "7:30 PM onwards", venue: "The Marigold Palace, Udaipur", family: "", colour: "ivory", size: "regular", position: "top" };
const sampleVideo = "/reels/wedding-reel.mp4";
type ReelEvent = { name: string; when: string };
type Template = NonNullable<ReturnType<typeof reelTemplate>>;
const EVENT_LOOKS = TEMPLATE_EVENTS as Record<string, ReelEvent[]>;
const FAMILY_LABEL: Record<string, string> = { tour: "Website link", ghar: "Signboard text" };

export function AiReelStudio() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"edit" | "generate">("edit");
  const [details, setDetails] = useState<EditorState>(DEFAULTS);
  const [videoUrl, setVideoUrl] = useState(sampleVideo);
  const [videoName, setVideoName] = useState("Wedding Film Reel");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState("");
  const [photoHash, setPhotoHash] = useState("");
  const [prompt, setPrompt] = useState(STARTER_PROMPT);
  const [quote, setQuote] = useState<{ token: string; totalUsd: number; seconds: number; resolution: string } | null>(null);
  const [job, setJob] = useState<{ state: string; videoUrl?: string; error?: string; actualCostUsd?: number; estimatedUsd?: number } | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [events, setEvents] = useState<ReelEvent[]>([]);
  const [captions, setCaptions] = useState<string[]>(GHAR_CAPTIONS);
  const [photos, setPhotos] = useState<string[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const objectUrls = useRef<string[]>([]);
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    const slug = searchParams.get("template");
    const chosen = slug ? reelTemplate(slug) : undefined;
    if (chosen) applyTemplate(chosen);
    else if (slug) setTab("generate");
  }, [searchParams]);
  function applyTemplate(chosen: Template | null) {
    setTemplate(chosen);
    if (!chosen) { setIsPlaying(false); return; }
    setDetails((current) => ({ ...current, ...chosen.defaults }));
    setEvents((EVENT_LOOKS[chosen.look] ?? []).map((item) => ({ ...item })));
    setCaptions(GHAR_CAPTIONS);
    setPhotos([]);
    setPrompt(chosen.prompt); setQuote(null);
    setVideoName(chosen.title); setTab("edit"); setIsPlaying(true);
  }
  function chooseLook(slug: string) { applyTemplate(slug ? reelTemplate(slug) ?? null : null); }
  function updateEvent(index: number, key: keyof ReelEvent, value: string) { setEvents((current) => current.map((item, at) => at === index ? { ...item, [key]: value } : item)); }
  function chooseScenePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/")).slice(0, 4);
    if (!files.length) return;
    const urls = files.map((file) => URL.createObjectURL(file)); objectUrls.current.push(...urls); setPhotos(urls);
  }
  const overlayClass = useMemo(() => `absolute inset-x-4 z-10 grid justify-items-center text-center ${details.position === "top" ? "top-7" : "bottom-8"}`, [details.position]);
  const tone = details.colour === "gold" ? "text-gold-300" : details.colour === "ink" ? "text-navy-950" : "text-ivory-50";
  const shadow = details.colour === "ink" ? "bg-ivory-50/85" : "bg-navy-950/35";
  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) { setDetails((current) => ({ ...current, [key]: value })); }
  function chooseVideo(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); objectUrls.current.push(url); setVideoUrl(url); setVideoName(file.name.replace(/\.[^.]+$/, "")); setTemplate(null); setTab("edit"); }
  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3000000) { setGenerationError("Choose a JPG, PNG or WebP photo under 3 MB."); return; }
    const url = URL.createObjectURL(file); objectUrls.current.push(url); setPhotoUrl(url);
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read this photo.")); reader.readAsDataURL(file); });
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), (item) => item.toString(16).padStart(2, "0")).join("");
    setPhotoData(data); setPhotoHash(hash); setQuote(null); setJob(null); setGenerationError("");
  }
  async function reviewCost() {
    if (!photoData || !photoHash) { setGenerationError("Upload the couple photo first."); return; }
    setBusy(true); setGenerationError("");
    try { const response = await fetch("/api/ai-reel/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, photoHash, seconds: 15, resolution: "720p" }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setQuote(result); }
    catch (error) { setGenerationError(error instanceof Error ? error.message : "Could not review the generation cost."); }
    finally { setBusy(false); }
  }
  async function generate() {
    if (!quote) return; setBusy(true); setGenerationError("");
    try { const response = await fetch("/api/ai-reel/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: quote.token, confirmed: true, image: photoData }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setJob(result); }
    catch (error) { setGenerationError(error instanceof Error ? error.message : "Could not start the video."); }
    finally { setBusy(false); }
  }
  async function checkProgress() {
    if (!quote) return; setBusy(true); setGenerationError("");
    try { const response = await fetch("/api/ai-reel/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: quote.token }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setJob(result); if (result.videoUrl) { setVideoUrl(result.videoUrl); setVideoName("AI generated wedding reel"); setTemplate(null); setTab("edit"); } }
    catch (error) { setGenerationError(error instanceof Error ? error.message : "Could not check video progress."); }
    finally { setBusy(false); }
  }
  function togglePlay() { if (template) { setIsPlaying((playing) => !playing); return; } const current = video.current; if (!current) return; if (current.paused) { void current.play(); setIsPlaying(true); } else { current.pause(); setIsPlaying(false); } }
  return <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32"><div className="mx-auto max-w-7xl px-4 sm:px-6">
    <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-semibold uppercase tracking-[.28em] text-gold-600">AI wedding video</p><h1 className="mt-3 font-display text-4xl text-navy-950 sm:text-5xl">Your story, ready for a reel.</h1><p className="mx-auto mt-4 max-w-2xl text-navy-700">Upload an existing reel to place ceremony lettering over it, or prepare an animated-video brief from a couple photo. Every preview is 9:16 for Instagram and WhatsApp.</p></div>
    <div className="mx-auto mt-9 flex w-fit max-w-full rounded-full border border-navy-950/10 bg-white p-1 shadow-sm"><button type="button" onClick={() => setTab("edit")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "edit" ? "bg-navy-950 text-ivory-50" : "text-navy-700"}`}>Edit a reel</button><button type="button" onClick={() => setTab("generate")} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === "generate" ? "bg-navy-950 text-ivory-50" : "text-navy-700"}`}>Create AI video</button></div>
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start"><section className="rounded-3xl border border-navy-950/10 bg-white p-5 shadow-sm sm:p-7">
      {tab === "edit" ? <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-600">Reel editor</p><h2 className="mt-1 font-display text-2xl text-navy-950">{template ? "Edit your reel" : "Edit the text over your video"}</h2></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-ivory-50"><Upload size={15}/> Upload MP4<input className="sr-only" accept="video/mp4,video/webm,video/quicktime" type="file" onChange={chooseVideo}/></label></div><p className="mt-3 text-sm text-navy-700/70">Currently editing: <b className="text-navy-950">{videoName}</b>. The lettering preview updates instantly; save this setup before production export is connected.</p>
      <label className="mt-5 block text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">Reel style<select value={template?.slug ?? ""} onChange={(event) => chooseLook(event.target.value)} className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-navy-950 focus:border-gold-500 focus:outline-none"><option value="">My video (lettering over the video)</option>{REEL_TEMPLATES.map((item) => <option key={item.slug} value={item.slug}>{item.title} — animated template</option>)}</select></label>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="Bride name" value={details.bride} onChange={(value) => update("bride", value)} /><Field label="Groom name" value={details.groom} onChange={(value) => update("groom", value)} /><Field label="Ceremony" value={details.ceremony} onChange={(value) => update("ceremony", value)} /><Field label="Date" value={details.date} onChange={(value) => update("date", value)} /><Field label="Time" value={details.time} onChange={(value) => update("time", value)} /><Field label="Venue / address" value={details.venue} onChange={(value) => update("venue", value)} />{template && FAMILY_LABEL[template.look] && <Field label={FAMILY_LABEL[template.look] ?? ""} value={details.family} onChange={(value) => update("family", value)} />}</div>
      {template && <TemplateExtras look={template.look} events={events} captions={captions} photoCount={photos.length} onEvent={updateEvent} onAdd={() => setEvents((current) => current.length < 4 ? [...current, { name: "", when: "" }] : current)} onRemove={(index) => setEvents((current) => current.filter((_, at) => at !== index))} onCaption={(index, value) => setCaptions((current) => current.map((line, at) => at === index ? value : line))} onPhotos={chooseScenePhotos} />}
      {!template && <div className="mt-6 grid gap-4 border-t border-navy-950/10 pt-6 sm:grid-cols-3"><Choice label="Text position" value={details.position} onChange={(value) => update("position", value as TextPosition)} options={[{ value: "top", label: "At the top" }, { value: "bottom", label: "At the bottom" }]} /><Choice label="Letter colour" value={details.colour} onChange={(value) => update("colour", value as EditorState["colour"])} options={[{ value: "ivory", label: "Classic ivory" }, { value: "gold", label: "Elegant gold" }, { value: "ink", label: "Deep ink" }]} /><Choice label="Heading size" value={details.size} onChange={(value) => update("size", value as EditorState["size"])} options={[{ value: "regular", label: "Regular" }, { value: "large", label: "Large" }]} /></div>}<button type="button" onClick={() => template ? applyTemplate(template) : setDetails(DEFAULTS)} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy-700 underline underline-offset-4"><RotateCcw size={15}/> Reset lettering</button></> : <><p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-600">AI reel brief</p><h2 className="mt-1 font-display text-2xl text-navy-950">Create a new animated wedding moment</h2><p className="mt-3 text-sm text-navy-700/70">Upload the couple photo and adjust this default cinematic prompt. It is ready for the AI-generation connection; uploading a photo alone does not create or charge for a video.</p>
      <ReelSamplePicker onChoose={(preset) => { setPrompt(preset.prompt); setQuote(null); }} />
      <label className="mt-6 grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed border-navy-950/20 bg-ivory-50 p-4 text-center">{photoUrl ? <span className="relative block"><img src={photoUrl} className="h-32 w-24 rounded-xl object-cover" alt="Couple upload preview"/><button type="button" onClick={(event) => { event.preventDefault(); setPhotoUrl(null); setPhotoData(""); setPhotoHash(""); setQuote(null); }} className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-navy-950 text-white"><X size={15}/></button></span> : <span><ImagePlus className="mx-auto text-gold-600"/><b className="mt-2 block text-sm text-navy-950">Upload a couple photo</b><small className="mt-1 block text-navy-700/60">JPG, PNG or WebP · under 3 MB</small></span>}<input className="sr-only" accept="image/jpeg,image/png,image/webp" type="file" onChange={choosePhoto}/></label>
      <label className="mt-6 block text-sm font-semibold text-navy-950">Animation prompt<textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); setQuote(null); }} rows={10} maxLength={12000} className="mt-2 w-full rounded-xl border border-navy-950/15 px-3 py-3 font-normal text-navy-700 focus:border-gold-500 focus:outline-none"/></label>
      <p className="mt-2 text-right text-xs text-navy-700/55">{prompt.length.toLocaleString()} / 12,000</p>
      {!quote ? <button type="button" disabled={busy || !photoData || prompt.trim().length < 30} onClick={reviewCost} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-950 px-5 py-3 text-sm font-semibold text-ivory-50 disabled:opacity-50">{busy ? "Reviewing…" : "Review generation credits"}</button> : <div className="mt-4 rounded-2xl bg-gold-500/10 p-4 text-sm text-navy-700"><p><b className="text-navy-950">Estimated xAI credits: ${quote.totalUsd.toFixed(2)}</b> · {quote.seconds}s · {quote.resolution}</p><p className="mt-1 text-xs">Your photo is sent only after you confirm. The actual provider charge is shown when xAI returns it.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setQuote(null)} className="rounded-full border border-navy-950/15 px-4 py-2 text-xs font-semibold">Change</button><button type="button" disabled={busy} onClick={generate} className="rounded-full bg-navy-950 px-4 py-2 text-xs font-semibold text-ivory-50">{busy ? "Starting…" : "Confirm and generate"}</button></div></div>}
      {generationError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{generationError}</p>}
      {job && <div className="mt-4 rounded-2xl border border-navy-950/10 p-4 text-sm text-navy-700"><b className="text-navy-950">{job.state === "done" ? "Video ready" : job.state === "pending" ? "Video is generating" : "Generation update"}</b>{job.actualCostUsd !== undefined && <p className="mt-1">Actual xAI credits used: ${job.actualCostUsd.toFixed(2)}</p>}{job.error && <p className="mt-1 text-red-700">{job.error}</p>}{job.videoUrl && <p className="mt-2"><a className="font-semibold underline" href={job.videoUrl} target="_blank" rel="noreferrer">Open generated MP4</a></p>}{["pending", "starting"].includes(job.state) && <button type="button" disabled={busy} onClick={checkProgress} className="mt-3 rounded-full bg-navy-950 px-4 py-2 text-xs font-semibold text-ivory-50">{busy ? "Checking…" : "Check progress"}</button>}</div>}</>}
    </section>
    <aside className="lg:sticky lg:top-24"><p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[.25em] text-navy-700/55">Live preview · 9:16</p><div className="mx-auto max-w-[320px] overflow-hidden rounded-[32px] border-[7px] border-navy-950 bg-navy-950 shadow-2xl"><div className="relative aspect-[9/16] overflow-hidden bg-navy-950">{template ? <TemplateReel template={template} details={details} events={events} captions={captions} photos={photos} paused={!isPlaying} /> : <><video ref={video} key={videoUrl} src={videoUrl} poster="/reels/wedding-reel-poster.jpg" className="absolute inset-0 h-full w-full object-cover" loop playsInline muted onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /><div className={`${overlayClass} ${tone}`}><div className={`max-w-[92%] rounded-xl px-3 py-2.5 ${shadow}`}><p className={`font-display leading-none ${details.size === "large" ? "text-3xl" : "text-2xl"}`}>{details.ceremony || "Wedding ceremony"}</p><p className="mt-1 font-serif text-xs">{details.bride} &amp; {details.groom}</p><p className="mt-1 text-[10px]">{details.date} · {details.time}</p><p className="mt-1 text-[10px]">{details.venue}</p></div></div></>}</div></div><div className="mx-auto mt-4 flex max-w-[320px] gap-2"><button type="button" onClick={togglePlay} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-navy-950 px-4 py-2.5 text-sm font-semibold text-ivory-50">{isPlaying ? <Pause size={15}/> : <Play size={15}/>} {isPlaying ? "Pause" : "Play"}</button><Link href="/wedding/reels" className="inline-flex items-center justify-center rounded-full border border-navy-950/15 px-4 text-sm font-semibold text-navy-700">Templates</Link></div><p className="mx-auto mt-4 max-w-[320px] text-center text-xs leading-relaxed text-navy-700/60"><Music2 className="mr-1 inline" size={13}/>Keep the original video soundtrack when you upload an existing reel. Music/export can be added with the production render service.</p></aside>
    </div></div></div>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-navy-950/15 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-navy-950 focus:border-gold-500 focus:outline-none"/></label>; }
function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="block text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-navy-950 focus:border-gold-500 focus:outline-none">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
/** Quick-start briefs for "Create AI video": the studio presets plus the animated template moods. */
function ReelSamplePicker({ onChoose }: { onChoose: (preset: { name: string; prompt: string }) => void }) {
  const presets = [...REEL_PRESETS, ...REEL_TEMPLATES.map((item) => ({ name: item.title, prompt: item.prompt }))];
  return <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70"><Film className="mr-1 inline" size={13}/>Start from a mood</p><div className="mt-2 flex flex-wrap gap-2">{presets.map((preset) => <button key={preset.name} type="button" onClick={() => onChoose(preset)} className="rounded-full border border-navy-950/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-gold-500 hover:text-navy-950">{preset.name}</button>)}</div></div>;
}
/** Editors that only animated templates need: the ceremony list, the story subtitles and the scene photos. */
function TemplateExtras({ look, events, captions, photoCount, onEvent, onAdd, onRemove, onCaption, onPhotos }: { look: string; events: ReelEvent[]; captions: string[]; photoCount: number; onEvent: (index: number, key: keyof ReelEvent, value: string) => void; onAdd: () => void; onRemove: (index: number) => void; onCaption: (index: number, value: string) => void; onPhotos: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const input = "w-full rounded-xl border border-navy-950/15 px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none";
  return <div className="mt-6 border-t border-navy-950/10 pt-6">
    <p className="text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">Ceremonies in the reel</p>
    <div className="mt-2 grid gap-2">{events.map((item, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label={`Ceremony ${index + 1}`} value={item.name} onChange={(event) => onEvent(index, "name", event.target.value)} placeholder="Haldi" className={input}/><input aria-label={`Ceremony ${index + 1} date and time`} value={item.when} onChange={(event) => onEvent(index, "when", event.target.value)} placeholder="22 Feb · 10 AM" className={input}/><button type="button" onClick={() => onRemove(index)} aria-label={`Remove ceremony ${index + 1}`} className="grid w-10 place-items-center rounded-xl border border-navy-950/10 text-navy-700"><Trash2 size={15}/></button></div>)}</div>
    {events.length < 4 && <button type="button" onClick={onAdd} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-navy-700"><Plus size={15}/> Add ceremony</button>}
    {look === "ghar" && <><p className="mt-5 text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">Story subtitles</p><div className="mt-2 grid gap-2">{captions.map((line, index) => <input key={index} aria-label={`Subtitle ${index + 1}`} value={line} onChange={(event) => onCaption(index, event.target.value)} className={input}/>)}</div></>}
    {look === "cinema" && <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-navy-950/20 bg-ivory-50 px-4 py-3 text-sm text-navy-700"><span><b className="block text-navy-950">Scene photos</b>{photoCount ? `${photoCount} photo${photoCount > 1 ? "s" : ""} in the reel` : "Up to 4 photos, one per scene"}</span><span className="inline-flex items-center gap-1 rounded-full bg-navy-950 px-3 py-1.5 text-xs font-semibold text-ivory-50"><ImagePlus size={14}/> Choose</span><input className="sr-only" type="file" accept="image/*" multiple onChange={onPhotos}/></label>}
  </div>;
}
