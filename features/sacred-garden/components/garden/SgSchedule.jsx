"use client";
import { Artboard, El } from "./Artboard";
import g from "./garden.module.css";
import { SG_ART } from "./assets";
import SgHashtag from "./SgHashtag";
import s from "./SgSchedule.module.css";

// first marker's y; rows are 85px apart (105px when the events show a location) and a day heading adds 30px more
const FIRST = 215;
const dayOf = (item, i) => item.day || (i === 0 ? "Monday, 23rd Nov" : i === 3 ? "Tuesday, 24th Nov" : "");
function dotYs(items) {
  const gap = items.some((item) => item.location) ? 105 : 85;
  let y = FIRST;
  return items.map((item, i) => (i === 0 ? y : (y += gap + (dayOf(item, i) ? 30 : 0))));
}

/**
 * Order of the day on a torn-paper panel: times left, events right, a line of small diamonds,
 * and a rose that walks down the line as the guest scrolls. items: [{ time, title, location?, labelShift? }]
 * labelShift: nudge one event name up or down (px), e.g. when it wraps onto two lines.
 * hashtag: the couple's hashtag, under the last event ("Dance with us, post with …").
 */
export default function SgSchedule({ id = "sg-schedule", title = "Schedule of Events", items = [], rose = SG_ART.rose, hashtag }) {
  const ys = dotYs(items);
  const dotY = (i) => ys[i] ?? FIRST;
  const last = dotY(items.length - 1);
  const height = last + 180;
  // the line breaks above each day heading
  const starts = items.map((item, i) => (i === 0 || dayOf(item, i) ? i : -1)).filter((i) => i >= 0);
  const segments = starts.map((start, k) => ({ from: start === 0 ? 205 : dotY(start) + 8, to: k + 1 < starts.length ? dotY(starts[k + 1]) - 90 : last }));
  // the rose stops on each marker in turn, 100px of scrolling apart
  const walk = { ev: "scroll", trg: 0.5, list: items.map((_, i) => (i === 0 ? {} : { my: dotY(i) - FIRST, di: 125 })) };
  const fade = (i) => ({ style: "fadein", dur: 1.5, delay: [0, 0.1, 0.1, 0.3, 0.4][i] ?? 0.4 });

  return <Artboard id={id} height={height} mHeight={height} label="Schedule">
    <El x={-147} y={-20} w={744} h={346}><img className={g.stretch} src={SG_ART.paperTop} alt="" /></El>
    <El x={-147} y={321} w={744} h={height - 311}><img className={g.stretch} src={SG_ART.paperBottom} alt="" /></El>
    <El x={-55} y={45} w={560} h={64}><h2 className={`${g.text} ${g.title}`}>{title}</h2></El>
    <ol className={s.list}>
      {items.map((item, i) => <li key={i}>
        {dayOf(item, i) && <El x={0} y={dotY(i) - 72} w={450} h={30} z={8}>
          <span className={`${g.text} ${s.day}`}>{dayOf(item, i)}</span>
        </El>}
        <El x={47} y={dotY(i) + 4} w={180} h={0} className={g.row} appear={fade(i)}><span className={`${g.text} ${g.num} ${s.time}`}>{item.time.replace(/\s+onwards$/i, "")} {item.time.toLowerCase().endsWith(" onwards") && <small>onwards</small>}</span></El>
        <El x={244} y={dotY(i) + 4 + (item.labelShift ?? 0)} w={150} h={0} m={{ x: 246 }} className={g.row} appear={fade(i)}><span className={`${g.text} ${g.body} ${s.event}`}>{item.title}{item.location && <small className={s.place}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>{item.location}</small>}</span></El>
        <El x={221} y={dotY(i)} w={8} h={8} m={{ x: 220 }}><i className={s.dot} /></El>
      </li>)}
    </ol>
    {hashtag && <El x={45} y={last + 55} w={360} h={56} appear={{ style: "fadein", dur: 1.5 }}><SgHashtag tag={hashtag} lead="Dance with us, post with" /></El>}
    {segments.map(({ from, to }, k) => <El key={k} x={224} y={from} w={2} h={Math.max(0, to - from)} m={{ x: 223 }} className={s.line} />)}
    <El x={198} y={185} w={55} h={50} m={{ x: 197 }} z={8} steps={walk}><img src={rose} alt="" /></El>
    <El x={350} y={56} w={78} h={41} m={{ x: 342 }} appear={{ style: "fadeinright", dur: 2, dist: 40 }}><img src={SG_ART.flourishRight} alt="" /></El>
    <El x={21} y={56} w={79} h={41} m={{ x: 31 }} appear={{ style: "fadeinleft", dur: 2, dist: 40 }}><img src={SG_ART.flourishLeft} alt="" /></El>
  </Artboard>;
}
