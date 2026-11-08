"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InviteShell } from "@/features/sacred-garden/components";
import { SacredGardenInvitation, SgEnvelope } from "@/features/sacred-garden/components/garden";
import { FORM_GROUPS, formDefaults, buildInvitation, DESIGN_MUSIC, SAMPLE_CLOSING_VIDEO, colorFields, slugOptions, slugFor } from "@/features/sacred-garden/lib/invitation-form";
import { readImage } from "@/features/sacred-garden/lib/image-upload";
import useGrokFilm from "./useGrokFilm";
import { dmSans } from "@/lib/fonts";
import { supabaseBrowser } from "@/lib/supabase/client";
import { requestEventDesignUploadAction, requestWeddingMediaUploadAction, saveEventDesignAction, saveWeddingDesignAction, startWeddingDraftAction } from "@/features/sacred-garden/actions";
import s from "./create.module.css";

// the form's own clean text font (the invitation on the right keeps its design fonts)
const formFont = dmSans;

const MAX_AUDIO_MB = 15;
const MAX_VIDEO_MB = 50; // kept in the browser until Publish uploads it to storage

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

/**
 * A video: an uploaded file, a link, the sample (when there is one), or none.
 * sample: the sample video's path, or null for none. empty: the hint while no video is set; reset: the button that clears it.
 */
function VideoField({ value, onChange, sample = SAMPLE_CLOSING_VIDEO, empty = "No video: the couple photo is shown.", reset = "Remove" }) {
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
  const isSample = Boolean(sample) && value === sample;
  return <div className={s.imageField}>
    <p className={s.hint}>{isSample ? "Showing the sample video." : uploaded ? "Your uploaded video." : value ? "Video from your link." : empty}</p>
    {value && <video className={s.thumb} src={value} muted playsInline controls preload="metadata" />}
    <div className={s.row}>
      <label className={s.fileBtn}>{uploaded ? "Change video" : "Upload video"}<input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={pick} /></label>
      {sample && !isSample && <button type="button" className={s.linkBtn} onClick={() => { onChange(sample); setError(""); }}>Use the sample video</button>}
      {value && <button type="button" className={s.linkBtn} onClick={() => { onChange(""); setError(""); }}>{reset}</button>}
    </div>
    {!uploaded && <input className={s.input} placeholder="…or paste a video link (MP4)" value={isSample ? "" : value} onChange={(e) => onChange(e.target.value)} />}
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
    <p className={s.hint}>Your website will be at /events/{current}</p>
  </>;
}

/**
 * An uploaded file still held in the form as a data: URL → stored in Supabase Storage; returns its "media:" ref.
 * requestUpload(kind, contentType, size): the signed upload from the wizard (draft token) or the dashboard (event id).
 */
async function uploadDataUrl(requestUpload, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const kind = blob.type.startsWith("image/") ? "image" : blob.type.startsWith("video/") ? "video" : "audio";
  const signed = await requestUpload(kind, blob.type, blob.size);
  if (!signed.success) throw new Error(signed.error);
  const { bucket, path, uploadToken, contentType, ref } = signed.data;
  const { error } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, uploadToken, new Blob([blob], { type: contentType }));
  if (error) throw new Error(error.message);
  return ref;
}

/**
 * Left: the form. Right: the Sacred Garden invitation, updated as you type or upload.
 * Publish saves it into a wizard draft event (features/sacred-garden/actions.ts) and goes on to the next wizard step.
 * `inWizard`: shown as the wizard's Design step (app/start/[token]/design), so the button reads Save & Continue.
 * `rsvp`: the site's live RSVP section, shown in the preview where the design's own RSVP was (as on the published event).
 * `eventId`: the dashboard's Wedding Design page (app/admin/(dashboard)/wedding-design) — Save keeps the design on that
 * event and stays here.
 * @param {{ draftToken?: string | null, initialForm?: Record<string, string>, inWizard?: boolean, rsvp?: import("react").ReactNode, eventId?: string | null }} props
 */
export default function CreateInvitation({ draftToken = null, initialForm = formDefaults, inWizard = false, rsvp = null, eventId = null }) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [envelope, setEnvelope] = useState(false);
  const [publish, setPublish] = useState({ busy: false, error: "", saved: false });
  // files already uploaded (data: URL → "media:" ref), so saving again doesn't upload them twice
  const uploads = useRef(new Map());
  // the draft this design is saved into: the wizard's, or the one the first Publish starts
  const [token, setToken] = useState(draftToken);
  const c = useMemo(() => buildInvitation(form), [form]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const fontSample = (key) => (key === "fontBodyStyle"
    ? { fontFamily: `"${form.fontBody}", serif`, fontStyle: form.fontBodyStyle }
    : key.startsWith("font") ? { fontFamily: `"${form[key]}", serif` } : null);

  const slug = slugFor(form);
  // Grok re-letters our envelope film whenever the couple's initials change (not needed while their own opening video is used)
  const grok = useGrokFilm(c.monogram, form.introVideo ? c.monogram : form.envelopeLetters, (film, letters) => setForm((f) => ({ ...f, envelopeFilm: film, envelopeLetters: letters })));

  // Publish: upload the couple's files, save the design on the draft event, then on to the next wizard step
  const publishSite = async () => {
    if (publish.busy) return;
    if (!c.envelope.ready) { setPublish({ busy: false, error: `Wait until Grok has put ${c.monogram} on the envelope film, then save.`, saved: false }); return; }
    setPublish({ busy: true, error: "", saved: false });
    const upload = async (requestUpload, value) => {
      if (!uploads.current.has(value)) uploads.current.set(value, await uploadDataUrl(requestUpload, value));
      return uploads.current.get(value);
    };
    try {
      if (eventId) {
        const saved = { ...form, slug };
        for (const [key, value] of Object.entries(saved)) {
          if (typeof value === "string" && value.startsWith("data:")) saved[key] = await upload((...a) => requestEventDesignUploadAction(eventId, ...a), value);
        }
        const result = await saveEventDesignAction(eventId, saved);
        if (!result.success) throw new Error(result.error);
        setPublish({ busy: false, error: "", saved: true });
        router.refresh();
        return;
      }
      let draft = token;
      if (!draft) {
        const started = await startWeddingDraftAction(null);
        if (!started.success) throw new Error(started.error);
        draft = started.data.token;
        setToken(draft);
      }
      const saved = { ...form, slug };
      for (const [key, value] of Object.entries(saved)) {
        if (typeof value === "string" && value.startsWith("data:")) saved[key] = await upload((...a) => requestWeddingMediaUploadAction(draft, ...a), value);
      }
      const result = await saveWeddingDesignAction(draft, saved);
      if (!result.success) throw new Error(result.error);
      router.push(result.data.href);
    } catch (e) { setPublish({ busy: false, error: e.message || "Your website could not be saved.", saved: false }); }
  };

  const field = ([key, label, type = "text", choices]) => {
    if (type === "slug") return <div key={key} className={s.label}><span>{label}</span><SlugField value={form.slug} onChange={set("slug")} options={slugOptions(form)} current={slug} /></div>;
    if (type === "image") return <div key={key} className={s.label}><span>{label}</span><ImageField value={form[key]} onChange={set(key)} /></div>;
    if (key === "introVideoDesktop") return <div key={key} className={s.label}><span>{label}</span>
      <VideoField value={form[key] ?? ""} onChange={set(key)} sample={null} empty="None: computers show the phone video." /></div>;
    if (key === "introVideo") return <div key={key} className={s.label}><span>{label}</span>
      <VideoField value={form[key] ?? ""} onChange={set(key)} sample={null} empty={`The design's wax-seal envelope (${c.monogram}).`} reset="Use the design's envelope" /></div>;
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
        <h1>{eventId ? "Wedding design" : "Create your invitation"}</h1>
        <p>Type or upload on the left, and your invitation updates on the right.</p>
        <div className={s.actions}>
          {eventId
            ? <button type="button" className={s.reset} onClick={() => setForm(initialForm)} title="Undo changes since the last save">Undo</button>
            : <button type="button" className={s.reset} onClick={() => setForm(formDefaults)} title="Reset to sample">Reset</button>}
          <button type="button" className={s.envelopeBtn} disabled={!c.envelope.ready} onClick={() => setEnvelope(true)}
            title={c.envelope.ready ? "Preview the envelope" : "The envelope film is being made"}>Preview</button>
          <button type="button" className={s.envelopeBtn} disabled={publish.busy || !c.envelope.ready} onClick={publishSite}>{publish.busy ? "Saving…" : eventId ? "Save design" : inWizard ? "Save & Continue" : "Publish"}</button>
        </div>
        {publish.saved && <p className={s.hint} role="status">Saved — your website shows the new design.</p>}
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
      <div className={s.previewGarden}><SacredGardenInvitation c={c} rsvp={rsvp} /></div>
    </main>
    {envelope && <SgEnvelope video={c.envelope.video} desktopVideo={c.envelope.desktopVideo} music={c.music || undefined} monogram={c.monogram} sealTrack={c.envelope.sealTrack} sealImage={c.envelope.sealImage} tapLabel={c.envelope.tapLabel} onDone={() => setEnvelope(false)} />}
  </InviteShell>;
}
