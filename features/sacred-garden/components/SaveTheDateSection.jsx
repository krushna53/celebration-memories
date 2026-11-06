"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./SaveTheDateSection.module.css";
import { Button, Icon, Reveal, Section, SectionHeading, cx } from "./shared";
import { useT, useLang } from "./i18n";

const LOCALE = { en: "en-IN", hi: "hi-IN", mr: "mr-IN", gu: "gu-IN" };

const pad = (n) => String(n).padStart(2, "0");
const utcStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

function dateParts(iso, timeZone, locale) {
  const d = new Date(iso);
  const part = (opts) => new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(d);
  return {
    weekday: part({ weekday: "long" }).toUpperCase(),
    day: part({ day: "2-digit" }),
    month: part({ month: "long" }).toUpperCase(),
    year: part({ year: "numeric" }),
    time: part({ hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase(),
  };
}

/** Google Calendar link + downloadable .ics for the main event. */
function calendarLinks({ title, start, end, location, details }) {
  const from = new Date(start);
  const to = end ? new Date(end) : new Date(from.getTime() + 4 * 3600 * 1000);
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${utcStamp(from)}/${utcStamp(to)}&location=${encodeURIComponent(location ?? "")}&details=${encodeURIComponent(details ?? "")}`;
  const esc = (t = "") => t.replace(/[,;\\]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EveryMoment//Invitation//EN", "BEGIN:VEVENT", `UID:${utcStamp(from)}-${title.length}@everymoment`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART:${utcStamp(from)}`, `DTEND:${utcStamp(to)}`, `SUMMARY:${esc(title)}`, `LOCATION:${esc(location)}`, `DESCRIPTION:${esc(details)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return { google, ics };
}

function ScratchCanvas({ label, onReveal }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const moves = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    const paint = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const styles = getComputedStyle(canvas);
      const deep = styles.getPropertyValue("--inv-deep").trim() || "#1e1b4b";
      const accent = styles.getPropertyValue("--inv-accent").trim() || "#e5503c";
      const bright = styles.getPropertyValue("--inv-accent-bright").trim() || "#ff6b57";
      const g = ctx.createLinearGradient(0, 0, width, height);
      g.addColorStop(0, deep);
      g.addColorStop(0.55, "#332d7a");
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      // soft foil speckles
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(253,246,236,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(14, 14, width - 28, height - 28);
      ctx.fillStyle = bright;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2 - 34, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `28px ${styles.getPropertyValue("--inv-script").trim() || "cursive"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♥", width / 2, height / 2 - 33);
      ctx.fillStyle = "#fdf6ec";
      ctx.font = `600 13px ${styles.getPropertyValue("--inv-caps").trim() || "serif"}`;
      ctx.fillText(label.toUpperCase().split("").join(" "), width / 2, height / 2 + 18);
      ctx.fillStyle = accent;
      ctx.fillRect(width / 2 - 24, height / 2 + 38, 48, 2);
    };
    // fonts may load late; repaint once they are ready
    paint();
    document.fonts?.ready.then(() => { if (!moves.current) paint(); });
  }, [label]);

  const scratch = (e) => {
    const canvas = ref.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 24, 0, Math.PI * 2);
    ctx.fill();
    moves.current += 1;
    if (moves.current % 8 === 0) {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let clear = 0, total = 0;
      for (let i = 3; i < data.length; i += 4 * 40) { total++; if (data[i] === 0) clear++; }
      if (clear / total > 0.45) onReveal();
    }
  };

  return <canvas ref={ref} className={s.canvas} aria-label={`${label}. Drag across the card to reveal the date.`} role="img"
    onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e); }}
    onPointerMove={(e) => drawing.current && scratch(e)}
    onPointerUp={() => { drawing.current = false; }}
    onPointerCancel={() => { drawing.current = false; }} />;
}

/**
 * Scratch card that reveals the wedding date, then offers "add to calendar".
 * date / endDate: ISO strings with offset, e.g. "2027-02-14T18:30:00+05:30".
 */
export default function SaveTheDateSection({ id = "save-the-date", eyebrow = "Mark your calendar", title = "Save the Date", subtitle, date, endDate, timeZone = "Asia/Kolkata", eventTitle, location, details, scratch = true, scratchLabel = "Scratch to reveal", tone = "cream" }) {
  const [revealed, setRevealed] = useState(!scratch);
  const t = useT();
  const { lang } = useLang();
  const parts = useMemo(() => dateParts(date, timeZone, LOCALE[lang] ?? "en-IN"), [date, timeZone, lang]);
  const links = useMemo(() => calendarLinks({ title: eventTitle, start: date, end: endDate, location, details }), [eventTitle, date, endDate, location, details]);
  const downloadIcs = () => {
    const url = URL.createObjectURL(new Blob([links.ics], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "save-the-date.ics" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };
  const sparks = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return { "--x": `${Math.cos(a) * 150}px`, "--y": `${Math.sin(a) * 150}px`, animationDelay: `${(i % 3) * 60}ms` };
  }), []);

  return <Section id={id} tone={tone} narrow label="Save the date">
    <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
    <Reveal className={cx(s.card, revealed && s.revealed)}>
      <div className={s.face}>
        <div className={s.date} aria-hidden={!revealed}>
          <span className={s.weekday}>{parts.weekday}</span>
          <div className={s.dayRow}><span>{parts.month}</span><b className={s.day}>{parts.day}</b><span>{parts.year}</span></div>
          <span className={s.time}>{parts.time}</span>
        </div>
        {scratch && <ScratchCanvas label={scratchLabel} onReveal={() => setRevealed(true)} />}
        <div className={s.burst} aria-hidden="true">{sparks.map((style, i) => <i key={i} style={style} />)}</div>
      </div>
    </Reveal>
    {!revealed && <p className={s.hint}>{t("dragCard")} ·{" "}
      <button type="button" className={s.showLink} onClick={() => setRevealed(true)}>{t("showDate")}</button></p>}
    <Reveal className={s.actions} delay={120}>
      <Button href={links.google} target="_blank" rel="noopener noreferrer"><Icon name="calendar" size={18} />{t("addGoogle")}</Button>
      <Button variant="ghost" onClick={downloadIcs}>{t("addIcs")}</Button>
    </Reveal>
  </Section>;
}
