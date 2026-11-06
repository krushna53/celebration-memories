"use client";
import { useMemo, useState } from "react";
import { InviteShell } from "@/features/sacred-garden/components";
import { SacredGardenInvitation, SgEnvelope } from "@/features/sacred-garden/components/garden";
import { FORM_GROUPS, formDefaults, buildInvitation, DESIGN_MUSIC, SAMPLE_CLOSING_VIDEO, colorFields, slugOptions, slugFor } from "@/features/sacred-garden/lib/invitation-form";
import { readImage } from "@/features/sacred-garden/lib/image-upload";
import useGrokFilm from "./useGrokFilm";
import { DM_Sans } from "next/font/google";
import s from "./create.module.css";

// the form's own clean text font (the invitation on the right keeps its design fonts)
const formFont = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const MAX_AUDIO_MB = 15;
const MAX_VIDEO_MB = 4; // an uploaded video is saved with the website, which takes about 5 MB in all

/** One picture: upload from the device, or paste a URL. Empty = the design's own picture. */
function ImageField({ value, onChange }) {
  const [error, setError] = useState("");
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { onChange(await readImage(file)); setError(""); } catch (err) { setError(err.message); }
  };
  const uploaded = value.startsWith("data:");
  return <div className={s.imageField}>
    {value ? <img className={s.thumb} src={value} alt="" /> : <p className={s.hint}>Showing the design&apos;s picture.</p>}
    <div className={s.row}>
      <label className={s.fileBtn}>{value ? "Change photo" : "Upload photo"}<input type="file" accept="image/*" hidden onChange={pick} /></label>
      {value && <button type="button" className={s.linkBtn} onClick={() => onChange("")}>Remove</button>}
    </div>
    {!uploaded && <input className={s.input} placeholder="…or paste an image link" value={value} onChange={(e) => onChange(e.target.value)} />}
    {error && <p className={s.error}>{error}</p>}
  </div>;
}

/** Background music: the design's track, an uploaded file, a link, or none (empty). */
function AudioField({ value, onChange }) {
  const [error, setError] = useState("");
  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) { setError(`Please pick a file under ${MAX_AUDIO_MB} MB.`); return; }
    const reader = new FileReader();
    reader.onload = () => { onChange(reader.result); setError(""); };
    reader.onerror = () => setError("This file could not be read. Try an MP3.");
    reader.readAsDataURL(file);
  };
  const uploaded = value.startsWith("data:");
  const design = value === DESIGN_MUSIC;
  return <div className={s.imageField}>
    <p className={s.hint}>{design ? "Playing the design's music." : uploaded ? "Your uploaded music." : value ? "Music from your link." : "No music."}</p>
    {value && <audio className={s.audio} controls preload="none" src={value} />}
    <div className={s.row}>
      <label className={s.fileBtn}>{uploaded ? "Change music" : "Upload music"}<input type="file" accept="audio/*" hidden onChange={pick} /></label>
      {!design && <button type="button" className={s.linkBtn} onClick={() => { onChange(DESIGN_MUSIC); setError(""); }}>Use the design&apos;s music</button>}
      {value && <button type="button" className={s.linkBtn} onClick={() => onChange("")}>No music</button>}
    </div>
    {!uploaded && <input className={s.input} placeholder="…or paste a music link (MP3)" value={design ? "" : value} onChange={(e) => onChange(e.target.value)} />}
    {error && <p className={s.error}>{error}</p>}
  </div>;
}

/** Video at the bottom of the page: the sample reel, an uploaded file, a link, or none (empty = the couple photo). */
function VideoField({ value, onChange }) {
  const [error, setError] = useState("");
  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { setError(`Please pick a video under ${MAX_VIDEO_MB} MB, or paste a link to a bigger one.`); return; }
    const reader = new FileReader();
    reader.onload = () => { onChange(reader.result); setError(""); };
    reader.onerror = () => setError("This file could not be read. Try an MP4.");
    reader.readAsDataURL(file);
  };
  const uploaded = value.startsWith("data:");
  const sample = value === SAMPLE_CLOSING_VIDEO;
  return <div className={s.imageField}>
    <p className={s.hint}>{sample ? "Showing the sample video." : uploaded ? "Your uploaded video." : value ? "Video from your link." : "No video: the couple photo is shown."}</p>
    {value && <video className={s.thumb} src={value} muted playsInline controls preload="metadata" />}
    <div className={s.row}>
      <label className={s.fileBtn}>{uploaded ? "Change video" : "Upload video"}<input type="file" accept="video/mp4,video/webm,video/*" hidden onChange={pick} /></label>
      {!sample && <button type="button" className={s.linkBtn} onClick={() => { onChange(SAMPLE_CLOSING_VIDEO); setError(""); }}>Use the sample video</button>}
      {value && <button type="button" className={s.linkBtn} onClick={() => onChange("")}>Remove</button>}
    </div>
    {!uploaded && <input className={s.input} placeholder="…or paste a video link (MP4)" value={sample ? "" : value} onChange={(e) => onChange(e.target.value)} />}
    {error && <p className={s.error}>{error}</p>}
  </div>;
}

/** A dropdown; for fonts each choice is also shown in its own lettering. */
function SelectField({ value, onChange, choices, sample }) {
  return <>
    <select className={s.input} value={value} onChange={(e) => onChange(e.target.value)}>
      {choices.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
    {sample && <span className={s.fontSample} style={sample}>Kunal &amp; Aanchal — Wedding Day</span>}
  </>;
}

/** The website link: one-click choices made from the names, or the couple's own. Empty = the first choice. */
function SlugField({ value, onChange, options, current }) {
  return <>
    <div className={s.presets}>
      {options.map((o) => <button key={o} type="button" className={`${s.preset} ${o === current ? s.presetOn : ""}`} aria-pressed={o === current} onClick={() => onChange(o)}>{o}</button>)}
    </div>
    <input className={s.input} value={value} maxLength={60} placeholder={current} onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
    <p className={s.hint}>Your website will be at /wedding/{current}</p>
  </>;
}

const siteKey = (slug) => `everymoment-site-key:${slug}`;

/** Left: the form. Right: the Sacred Garden invitation, updated as you type or upload. */
export default function CreateInvitation() {
  const [form, setForm] = useState(formDefaults);
  const [envelope, setEnvelope] = useState(false);
  const [publish, setPublish] = useState({ busy: false, url: "", error: "" });
  const c = useMemo(() => buildInvitation(form), [form]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const fontSample = (key) => (key === "fontBodyStyle"
    ? { fontFamily: `"${form.fontBody}", serif`, fontStyle: form.fontBodyStyle }
    : key.startsWith("font") ? { fontFamily: `"${form[key]}", serif` } : null);

  const slug = slugFor(form);
  // Grok re-letters our envelope film whenever the couple's initials change
  const grok = useGrokFilm(c.monogram, form.envelopeLetters, (film, letters) => setForm((f) => ({ ...f, envelopeFilm: film, envelopeLetters: letters })));

  // Publish: save the form under the link and open the website in a new tab
  const publishSite = async () => {
    if (publish.busy) return;
    if (!c.envelope.ready) { setPublish({ busy: false, url: "", error: `Wait until Grok has put ${c.monogram} on the envelope film, then publish.` }); return; }
    const tab = window.open("", "_blank"); // opened now, so the browser does not block it as a pop-up
    setPublish({ busy: true, url: "", error: "" });
    try {
      let key = "";
      try { key = localStorage.getItem(siteKey(slug)) || ""; } catch { /* not kept */ }
      const r = await fetch("/api/website", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, form: { ...form, slug }, key }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "The website could not be published.");
      try { localStorage.setItem(siteKey(slug), data.key); } catch { /* republishing this link will need a new one */ }
      if (tab) tab.location.href = data.url; else window.open(data.url, "_blank");
      setPublish({ busy: false, url: data.url, error: "" });
    } catch (e) { tab?.close(); setPublish({ busy: false, url: "", error: e.message }); }
  };

  const field = ([key, label, type = "text", choices]) => {
    if (type === "slug") return <div key={key} className={s.label}><span>{label}</span><SlugField value={form.slug} onChange={set("slug")} options={slugOptions(form)} current={slug} /></div>;
    if (type === "image") return <div key={key} className={s.label}><span>{label}</span><ImageField value={form[key]} onChange={set(key)} /></div>;
    if (type === "video") return <div key={key} className={s.label}><span>{label}</span><VideoField value={form[key]} onChange={set(key)} /></div>;
    if (type === "audio") return <div key={key} className={s.label}><span>{label}</span><AudioField value={form[key]} onChange={set(key)} /></div>;
    if (type === "color") return <label key={key} className={s.colorRow}>
      <input type="color" className={s.swatchInput} value={form[key]} onChange={(e) => set(key)(e.target.value)} />
      <span>{label}</span>
      <input className={`${s.input} ${s.hex}`} value={form[key]} maxLength={7} aria-label={`${label} (hex)`}
        onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{0,6}$/i.test(v)) set(key)(v); }} />
    </label>;
    return <label key={key} className={s.label}>
      <span>{label}</span>
      {type === "select" ? <SelectField value={form[key]} onChange={set(key)} choices={choices} sample={fontSample(key)} />
        : type === "textarea" ? <textarea className={s.input} rows={4} value={form[key]} onChange={(e) => set(key)(e.target.value)} />
          : <input className={s.input} type={type} value={form[key]} onChange={(e) => set(key)(e.target.value)} />}
    </label>;
  };

  return <InviteShell className={s.page}>
    <aside className={`${s.formPane} ${formFont.className}`}>
      <header className={s.head}>
        <h1>Create your invitation</h1>
        <p>Type or upload on the left, and your invitation updates on the right.</p>
        <div className={s.actions}>
          <button type="button" className={s.reset} onClick={() => setForm(formDefaults)} title="Reset to sample">Reset</button>
          <button type="button" className={s.envelopeBtn} disabled={!c.envelope.ready} onClick={() => setEnvelope(true)}
            title={c.envelope.ready ? "Preview the envelope" : "The envelope film is being made"}>Preview</button>
          <button type="button" className={s.envelopeBtn} disabled={publish.busy || !c.envelope.ready} onClick={publishSite}>{publish.busy ? "Publishing…" : "Publish"}</button>
        </div>
        {publish.url && <p className={s.hint}>Published: <a href={publish.url} target="_blank" rel="noreferrer">{publish.url}</a></p>}
        {publish.error && <p className={s.error}>{publish.error}</p>}
        {grok.status && <p className={s.hint} role="status">{grok.status}</p>}
        {grok.askCode && <input className={s.input} type="password" autoComplete="off" placeholder="Owner code for Grok (asked once)" value={grok.code} onChange={(e) => grok.setCode(e.target.value)} />}
        {grok.error && <p className={s.error}>{grok.error} <button type="button" className={s.linkBtn} onClick={grok.retry}>Try again</button></p>}
      </header>
      <form onSubmit={(e) => e.preventDefault()}>
        {FORM_GROUPS.map((group) => <fieldset key={group.title} className={s.group}>
          <legend>{group.title}</legend>
          {group.hint && <p className={s.hint}>{group.hint}</p>}
          {group.presets && <div className={s.presets}>
            {group.presets.map(([name, k]) => {
              const on = form.colorAccent === k.accent && form.colorBackground === k.background && form.colorText === k.text;
              return <button key={name} type="button" className={`${s.preset} ${on ? s.presetOn : ""}`} aria-pressed={on}
                onClick={() => setForm((f) => ({ ...f, ...colorFields(k) }))}>
                <span className={s.dots} aria-hidden="true">{[k.background, k.accent, k.text, k.button].map((c) => <i key={c} style={{ background: c }} />)}</span>
                {name}
              </button>;
            })}
          </div>}
          {group.closingChoice && <div className={s.presets} role="radiogroup" aria-label="Photo or video">
            {[["photo", "Photo"], ["video", "Video"]].map(([kind, name]) => {
              const on = (form.closingVideo ? "video" : "photo") === kind;
              // only one at a time: picking video starts from the sample reel, picking photo drops the video
              return <button key={kind} type="button" role="radio" aria-checked={on} className={`${s.preset} ${on ? s.presetOn : ""}`}
                onClick={() => setForm((f) => (kind === "video" ? { ...f, closingVideo: f.closingVideo || SAMPLE_CLOSING_VIDEO, couplePhoto: "" } : { ...f, closingVideo: "" }))}>{name}</button>;
            })}
          </div>}
          {(group.closingChoice ? group.fields.filter(([key]) => key === (form.closingVideo ? "closingVideo" : "couplePhoto")) : group.fields).map(field)}
        </fieldset>)}
      </form>
    </aside>
    <main className={s.previewPane}>
      <div className={s.previewGarden}><SacredGardenInvitation c={c} /></div>
    </main>
    {envelope && <SgEnvelope video={c.envelope.video} music={c.music || undefined} monogram={c.monogram} sealTrack={c.envelope.sealTrack} sealImage={c.envelope.sealImage} tapLabel={c.envelope.tapLabel} onDone={() => setEnvelope(false)} />}
  </InviteShell>;
}
