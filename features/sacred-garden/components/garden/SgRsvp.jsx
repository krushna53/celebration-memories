"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Artboard, El } from "./Artboard";
import { Chevron } from "./SgHero";
import g from "./garden.module.css";
import { SG_ART } from "./assets";
import s from "./SgRsvp.module.css";

const bob = { ev: "intoview", trg: 1, loop: true, list: [{}, { my: 5, ti: 600 }, { ti: 500 }] };

/**
 * RSVP form in a pop-up. fields: [{ name, type: "text" | "radio", options?, hint?, required? }]
 * The reply is POSTed as a form to `endpoint` (Google Apps Script web app, Formspree, …) with one entry
 * per field name plus submitted_at and page. Without an endpoint (a demo) it only shows the thank-you.
 * theme: CSS variables (colours, fonts) to carry over, since the pop-up sits outside the page.
 */
export function SgRsvpDialog({ open, onClose, title, note, fields = [], endpoint, theme, submit = "Submit", required = "Required field",
  success = "Thank you! Your RSVP has been received.", failure = "Sorry, your RSVP could not be sent. Please try again." }) {
  const [values, setValues] = useState({});
  const [missing, setMissing] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;

  const set = (name, value) => { setValues((v) => ({ ...v, [name]: value })); setMissing((m) => m.filter((n) => n !== name)); };
  const send = async (e) => {
    e.preventDefault();
    const empty = fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.name);
    setMissing(empty);
    if (empty.length) return;
    setStatus("sending");
    try {
      if (endpoint) {
        const body = new URLSearchParams({ ...values, submitted_at: new Date().toISOString(), page: window.location.href });
        await fetch(endpoint, { method: "POST", body, mode: "no-cors" });
      }
      setStatus("sent");
    } catch {
      setStatus("idle");
      window.alert(failure);
    }
  };

  return createPortal(<div className={`${g.vars} ${s.backdrop}`} style={theme} onClick={onClose}>
    <button type="button" className={s.close} onClick={onClose} aria-label="Close dialog window">
      <svg width="23" height="23" viewBox="0 0 23 23" aria-hidden="true"><g fill="#fff"><rect x="10.31" y="-3.69" width="2" height="30" transform="rotate(-45 11.31 11.31)" /><rect x="10.31" y="-3.69" width="2" height="30" transform="rotate(45 11.31 11.31)" /></g></svg>
    </button>
    <div ref={panel} className={s.panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
      <div className={s.head}>
        <h2 className={s.title}>{title}</h2>
        {note && <p className={s.note}>{note}</p>}
      </div>
      {status === "sent"
        ? <div className={s.success} role="status">{success}</div>
        : <form onSubmit={send} noValidate>
          {fields.map((f) => {
            const bad = missing.includes(f.name);
            const id = `sg-rsvp-${f.name.replace(/\W+/g, "-").toLowerCase()}`;
            return <div key={f.name} className={`${s.group} ${bad ? s.bad : ""}`} role={f.type === "radio" ? "radiogroup" : undefined} aria-labelledby={`${id}-label`}>
              {f.type === "radio"
                ? <div className={s.label} id={`${id}-label`}>{f.name}</div>
                : <label className={s.label} id={`${id}-label`} htmlFor={id}>{f.name}</label>}
              {f.hint && <div className={s.hint}>{f.hint}</div>}
              {f.type === "radio"
                ? f.options.map((o) => <label key={o} className={s.radio}>
                  <input type="radio" name={f.name} value={o} checked={values[f.name] === o} onChange={() => set(f.name, o)} /><i /><span>{o}</span>
                </label>)
                : <input id={id} className={s.input} type="text" name={f.name} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} aria-required={f.required || undefined} />}
              {bad && <div className={s.error} aria-live="polite">{required}</div>}
            </div>;
          })}
          <button type="submit" className={s.submit} disabled={status === "sending"}><span>{submit}</span><i aria-hidden="true" /></button>
        </form>}
    </div>
  </div>, document.body);
}

/** "Confirm your attendance" with a wax seal; tapping the seal (or "Click to open") opens the RSVP pop-up. */
export default function SgRsvp({ id = "sg-rsvp", title = "Confirm Your Attendance", text, openLabel = "Click to open", seal = SG_ART.waxSeal, ...dialog }) {
  const [open, setOpen] = useState(false);
  return <Artboard id={id} height={438} label={title}>
    <El x={-55} y={51} w={560} h={64}><h2 className={`${g.text} ${g.title}`}>{title}</h2></El>
    {text && <El x={39} y={135} w={372} h={52} appear={{ style: "fadeinup", dur: 2, dist: 40 }}><p className={`${g.text} ${g.body}`}>{text}</p></El>}
    <El x={130} y={210} w={190} h={142} appear={{ style: "zoomin", dur: 1.5, delay: 0.5, scale: 0.9 }}>
      <button type="button" className={`${g.link} ${s.seal}`} onClick={() => setOpen(true)} aria-label={openLabel}><img src={seal} alt="" /></button>
    </El>
    <El x={212} y={368} w={25} h={16} steps={bob}><Chevron up /></El>
    <El x={113} y={387} w={224} h={50} steps={bob}>
      <button type="button" className={`${g.link} ${g.text} ${s.open}`} onClick={() => setOpen(true)}>{openLabel}</button>
    </El>
    <SgRsvpDialog open={open} onClose={() => setOpen(false)} title={title} {...dialog} />
  </Artboard>;
}
