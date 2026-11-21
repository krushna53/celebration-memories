"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { GHAR_CAPTIONS, TEMPLATE_EVENTS } from "./reel-templates";
import "../showcase-fonts.css";
import s from "./TemplateReel.module.css";

const SCENE_MS = 3200;

/** "11 October 2026" → { day: "11", month: "OCT", year: "2026", weekday: "SUNDAY" }; falls back to the words given. */
function dateParts(text) {
  const when = new Date(String(text || "").replace(/^[A-Za-z]+,\s*/, ""));
  if (!Number.isNaN(when.getTime())) {
    return {
      day: String(when.getDate()),
      month: when.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      year: String(when.getFullYear()),
      weekday: when.toLocaleString("en-US", { weekday: "long" }).toUpperCase(),
      time: when.getTime(),
    };
  }
  const [day = "", month = "", year = ""] = String(text || "").split(/\s+/);
  return { day, month: month.slice(0, 3).toUpperCase(), year, weekday: "", time: 0 };
}

function useScene(count, paused) {
  const [scene, setScene] = useState(0);
  useEffect(() => { setScene(0); }, [count]);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setScene((current) => (current + 1) % count), SCENE_MS);
    return () => clearInterval(timer);
  }, [count, paused]);
  return scene;
}

/** Plays only while on screen, so a page of live previews stays light. */
function useOnScreen() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

/**
 * A 9:16 animated wedding reel drawn with HTML and CSS. Every word comes from props, so the studio can edit it live.
 * Sizes use container units, so the same reel works as a gallery thumbnail and in the studio preview.
 */
export default function TemplateReel({ template, details, events, captions, photos, paused = false }) {
  const look = template?.look ?? "tour";
  const d = { ...(template?.defaults ?? {}), ...(details ?? {}) };
  const list = (events?.length ? events : TEMPLATE_EVENTS[look] ?? []).filter((item) => item.name || item.when).slice(0, 4);
  const lines = captions?.length ? captions : GHAR_CAPTIONS;
  const pics = photos?.length ? photos : template?.photos ?? [];
  const count = look === "tour" ? 6 : look === "ghar" ? 3 + list.length : look === "scroll" ? 1 + list.length : 2 + list.length;
  const [ref, visible] = useOnScreen();
  const scene = useScene(count, paused || !visible);
  const parts = useMemo(() => dateParts(d.date), [d.date]);
  const props = { d, list, scene, parts, lines, pics };
  return <div ref={ref} className={`${s.reel} ${s[`look_${look}`] ?? ""}`} data-scene={scene}>
    {look === "tour" && <Tour {...props} />}
    {look === "sangeet" && <Sangeet {...props} />}
    {look === "scroll" && <Scroll {...props} />}
    {look === "cinema" && <Cinema {...props} />}
    {look === "ghar" && <Ghar {...props} />}
    <i className={s.grain} aria-hidden="true" />
  </div>;
}

const names = (d, joiner = "&") => <>{d.bride || "Bride"} <em>{joiner}</em> {d.groom || "Groom"}</>;

/* ---------- 1. Website tour: a phone walks through the couple's site ---------- */
const TOUR_STEPS = ["Grand welcome", "Every ceremony", "Countdown", "Easy RSVP"];
function Tour({ d, list, scene, parts }) {
  const days = parts.time ? Math.max(0, Math.ceil((parts.time - Date.now()) / 86400000)) : 120;
  const step = scene - 1;
  return <div className={s.tour}>
    <div className={s.tourHalo} />
    {scene === 0 && <h3 key="h" className={s.tourHead}><span>Your wedding,</span><span>now a <b>website.</b></span></h3>}
    {scene === 5 && <div key="o" className={s.tourOut}><p className={s.tourNames}>{names(d)}</p><p className={s.tourSub}>{d.date} · {d.venue}</p><span className={s.tourUrl}>{d.family || "everymoment.in"}</span></div>}
    {scene >= 1 && scene <= 4 && <>
      <ol className={s.tourList}>{TOUR_STEPS.map((label, index) => <li key={label} className={index === step ? s.on : ""}><small>0{index + 1}</small>{label}</li>)}</ol>
      <div className={s.phone}><div className={s.notch} /><div className={s.screen}>
        <div className={s.screenBar}>{(d.bride || "a").toLowerCase()}-{(d.groom || "b").toLowerCase()}.site</div>
        <div key={scene} className={s.page}>
          {step === 0 && <div className={s.pWelcome}><div className={s.pArch} /><p className={s.pKicker}>Together with our families</p><p className={s.pNames}>{names(d)}</p><p className={s.pDate}>{d.date}</p></div>}
          {step === 1 && <div className={s.pEvents}>{list.map((item, index) => <div key={index} className={s.pCard} style={{ animationDelay: `${index * 160}ms` }}><b>{item.name}</b><span>{item.when}</span></div>)}</div>}
          {step === 2 && <div className={s.pCount}><p>Counting down</p><b>{days}</b><span>days to go</span><small>{d.date}</small></div>}
          {step === 3 && <div className={s.pRsvp}><p className={s.pKicker}>Kindly reply</p><b>RSVP</b><i /><i /><span className={s.pBtn}>Submit RSVP</span></div>}
        </div>
      </div></div>
    </>}
  </div>;
}

/* ---------- 2. Lantern sangeet: dusk sky, swinging bulbs, dancing couple ---------- */
function Sangeet({ d, list, scene }) {
  const card = scene >= 1 && scene <= list.length ? list[scene - 1] : null;
  return <div className={s.sangeet}>
    <div className={s.moon} />
    <div className={s.bulbs}>{Array.from({ length: 13 }, (_, index) => <i key={index} style={{ "--k": index }} />)}</div>
    {Array.from({ length: 10 }, (_, index) => <i key={index} className={s.fly} style={{ "--k": index, "--y": (index * 37) % 30 }} />)}
    <div className={s.tree}><span /><span /><span /><span /><span />{[0, 1, 2, 3, 4].map((index) => <b key={index} className={s.lantern} style={{ "--k": index, "--y": (index % 2) * 9 }} />)}</div>
    <Dancers />
    <div className={s.ground} />
    <div key={scene} className={s.sangeetText}>
      {scene === 0 && <><p className={s.sKicker}>You are invited to</p><h3 className={s.sTitle}>{d.ceremony || "Sangeet Night"}</h3><p className={s.sNames}>{names(d)}</p></>}
      {card && <><p className={s.sKicker}>{d.bride} &amp; {d.groom}</p><h3 className={s.sTitle}>{card.name}</h3><p className={s.sWhen}>{card.when}</p></>}
      {scene === list.length + 1 && <><h3 className={s.sTitle}>{d.date}</h3><p className={s.sWhen}>{d.time}</p><p className={s.sWhen}>{d.venue}</p></>}
    </div>
  </div>;
}

/** Two illustrated dancers: a lehenga that swirls and a sherwani that sways. */
function Dancers() {
  return <svg className={s.dancers} viewBox="0 0 200 150" aria-hidden="true">
    <g className={s.her}>
      <circle cx="78" cy="34" r="9" fill="#3b2318" />
      <path d="M70 31 q8 -14 18 0 q-2 -8 -9 -9 q-7 1 -9 9Z" fill="#20120c" />
      <path d="M72 44 h12 l3 22 h-18Z" fill="#f2b8c6" />
      <path className={s.skirt} d="M69 64 h20 l20 62 q-30 10 -60 0Z" fill="#e87aa0" />
      <path className={s.skirtHem} d="M50 122 q30 10 58 0 l2 6 q-31 11 -62 0Z" fill="#f6d36b" />
      <path className={s.armUp} d="M84 47 q14 -10 18 -26" stroke="#c98f6c" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M72 48 q-12 8 -14 22" stroke="#c98f6c" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M71 44 q-10 18 2 40" stroke="#fff3c9" strokeWidth="2" fill="none" opacity=".8" />
    </g>
    <g className={s.him}>
      <circle cx="128" cy="30" r="9" fill="#5b3a28" />
      <path d="M119 27 q9 -12 18 0 q0 -6 -9 -7 q-9 1 -9 7Z" fill="#1f130d" />
      <path d="M119 40 h18 l6 66 h-30Z" fill="#2f4f8f" />
      <path d="M128 40 v66" stroke="#f3cf75" strokeWidth="1.5" strokeDasharray="2 4" />
      <path d="M120 104 h7 v24 h-7Z M131 104 h7 v24 h-7Z" fill="#f4ead6" />
      <path className={s.armHis} d="M135 44 q16 -6 22 -22" stroke="#b9805e" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M121 46 q-12 10 -18 4" stroke="#b9805e" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M118 41 q10 14 20 0" stroke="#f3cf75" strokeWidth="3" fill="none" />
    </g>
  </svg>;
}

/* ---------- 3. Royal scroll: two rollers part and the patrika unrolls ---------- */
function Scroll({ d, list, scene, parts }) {
  const item = scene >= 1 ? list[scene - 1] : null;
  const tiles = item ? dateParts(item.when.split("·")[0]?.trim() + " " + parts.year) : parts;
  return <div className={s.scroll}>
    <div className={s.wall} />
    <div className={s.patrika}>
      <div className={`${s.roller} ${s.rollTop}`}><i /><i /></div>
      <div className={s.paper}>
        <div className={s.mandala} />
        <div key={scene} className={s.paperText}>
          <p className={s.ganesh}>॥ Shree Ganeshay Namah ॥</p>
          <h3 className={s.scTitle}>{item ? item.name : d.ceremony || "Shubh Vivah"}</h3>
          <p className={s.scNames}>{names(d, "weds")}</p>
          <div className={s.tiles}>
            <span style={{ animationDelay: "900ms" }}>{tiles.day || "–"}</span>
            <span style={{ animationDelay: "1150ms" }}>{tiles.month || "–"}</span>
            <span style={{ animationDelay: "1400ms" }}>{tiles.year || parts.year}</span>
          </div>
          <p className={s.scWhen}>{item ? item.when.split("·")[1]?.trim() || item.when : d.time}</p>
          <p className={s.scVenue}>{d.venue}</p>
        </div>
        <div className={s.kalashes}><Kalash /><Kalash /></div>
      </div>
      <div className={`${s.roller} ${s.rollBottom}`}><i /><i /></div>
    </div>
  </div>;
}

function Kalash() {
  return <svg viewBox="0 0 40 52" aria-hidden="true">
    <path d="M14 14 q-6 -6 0 -12 q4 4 6 10 q2 -6 6 -10 q6 6 0 12Z" fill="#4f7a3a" />
    <circle cx="20" cy="12" r="5" fill="#c9762b" />
    <path d="M12 18 h16 l-2 4 q12 6 10 18 q-2 10 -16 10 q-14 0 -16 -10 q-2 -12 10 -18Z" fill="#c9962f" />
    <path d="M6 34 h28" stroke="#8a1c24" strokeWidth="3" />
    <circle cx="20" cy="40" r="2.5" fill="#8a1c24" />
  </svg>;
}

/* ---------- 4. Royal cinema: letterboxed slow zooms with titles ---------- */
function Cinema({ d, list, scene, parts, pics }) {
  const item = scene >= 1 && scene <= list.length ? list[scene - 1] : null;
  const photo = pics.length ? pics[scene % pics.length] : null;
  return <div className={s.cinema}>
    <div key={`p${scene}`} className={s.frame} style={photo ? { backgroundImage: `url("${photo}")` } : undefined} />
    <div className={s.vignette} />
    <i key={`l${scene}`} className={s.leak} />
    <div className={s.bars}><i /><i /></div>
    <div key={scene} className={s.cineText}>
      {scene === 0 && <><p className={s.cKicker}>Save the date</p><h3 className={s.cNames}>{names(d)}</h3><p className={s.cRule}>{parts.weekday ? `${parts.weekday} · ` : ""}{d.date}</p></>}
      {item && <><h3 className={s.cTitle}>{item.name}</h3><p className={s.cRule}>{item.when}</p><p className={s.cSmall}>{d.venue}</p></>}
      {scene === list.length + 1 && <><p className={s.cKicker}>We can&apos;t wait to celebrate with you</p><h3 className={s.cNames}>{names(d)}</h3><p className={s.cRule}>{d.date} · {d.time}</p><p className={s.cSmall}>{d.venue}</p></>}
    </div>
  </div>;
}

/* ---------- 5. Shaadi ka ghar: a decorated home tells the story ---------- */
function Ghar({ d, list, scene, lines }) {
  const open = scene >= 1;
  const item = scene >= 3 ? list[scene - 3] : null;
  const caption = scene <= 2 ? lines[scene] : `${item?.name ?? ""} · ${item?.when ?? ""}`;
  return <div className={`${s.ghar} ${open ? s.gharOpen : ""}`}>
    <div className={s.facade}>
      <div className={s.windows}><i /><i /></div>
      <div className={s.garland}>{Array.from({ length: 15 }, (_, index) => <i key={index} style={{ "--k": index }} />)}</div>
      <div className={s.sign}><b>{d.family || "Shaadi ka Ghar"}</b></div>
      <div className={s.doorway}>
        <div className={s.inside}>
          <div className={s.lamp} />
          <div key={scene} className={s.insideText}>
            {scene <= 2 && <><p className={s.gKicker}>{scene === 2 ? "The wedding of" : "Welcome home"}</p><h3 className={s.gNames}>{names(d)}</h3><p className={s.gDate}>{d.date}</p></>}
            {item && <><p className={s.gKicker}>{d.bride} &amp; {d.groom}</p><h3 className={s.gNames}>{item.name}</h3><p className={s.gDate}>{item.when}</p><p className={s.gVenue}>{d.venue}</p></>}
          </div>
        </div>
        <div className={`${s.leaf} ${s.leafL}`}><i /><i /><b /></div>
        <div className={`${s.leaf} ${s.leafR}`}><i /><i /><b /></div>
        <div className={s.toran}>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div>
      </div>
      <div className={s.step} />
    </div>
    <p key={`c${scene}`} className={s.caption}>{caption}</p>
  </div>;
}
