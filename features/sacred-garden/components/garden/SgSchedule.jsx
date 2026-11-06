"use client";
import { Artboard, El } from "./Artboard";
import g from "./garden.module.css";
import { SG_ART } from "./assets";
import s from "./SgSchedule.module.css";

// y of each marker on the line; rows after the fifth keep the same spacing
const DOTS = [161, 243, 320, 399, 475];
const dotY = (i) => DOTS[i] ?? DOTS[4] + (i - 4) * 78;

/**
 * Order of the day on a torn-paper panel: times left, events right, a line of small diamonds,
 * and a rose that walks down the line as the guest scrolls. items: [{ time, title, labelShift? }]
 * labelShift: nudge one event name up or down (px), e.g. when it wraps onto two lines.
 */
export default function SgSchedule({ id = "sg-schedule", title = "Schedule of Events", items = [], rose = SG_ART.rose }) {
  const n = Math.max(1, items.length);
  const extra = Math.max(0, n - 5) * 78;
  const last = dotY(n - 1);
  // the rose stops on each marker in turn, 100px of scrolling apart
  const walk = { ev: "scroll", trg: 0.5, list: items.map((_, i) => (i === 0 ? {} : { my: dotY(i) - DOTS[0], di: 100 })) };
  const fade = (i) => ({ style: "fadein", dur: 1.5, delay: [0, 0.1, 0.1, 0.3, 0.4][i] ?? 0.4 });

  return <Artboard id={id} height={570 + extra} label="Schedule">
    <El x={-147} y={-20} w={744} h={346}><img className={g.stretch} src={SG_ART.paperTop} alt="" /></El>
    <El x={-147} y={321} w={744} h={259 + extra}><img className={g.stretch} src={SG_ART.paperBottom} alt="" /></El>
    <El x={-55} y={45} w={560} h={64}><h2 className={`${g.text} ${g.title}`}>{title}</h2></El>
    <ol className={s.list}>
      {items.map((item, i) => <li key={i}>
        <El x={47} y={dotY(i) + 4} w={180} h={0} className={g.row} appear={fade(i)}><span className={`${g.text} ${g.num} ${s.time}`}>{item.time}</span></El>
        <El x={266} y={dotY(i) + 4 + (item.labelShift ?? 0)} w={100} h={0} m={{ x: 268 }} className={g.row} appear={fade(i)}><span className={`${g.text} ${g.body} ${s.event}`}>{item.title}</span></El>
        <El x={221} y={dotY(i)} w={8} h={8} m={{ x: 220 }}><i className={s.dot} /></El>
      </li>)}
    </ol>
    <El x={224} y={160} w={2} h={last - 154} m={{ x: 223 }} className={s.line} />
    <El x={198} y={140} w={55} h={50} m={{ x: 197 }} steps={walk}><img src={rose} alt="" /></El>
    <El x={350} y={56} w={78} h={41} m={{ x: 342 }} appear={{ style: "fadeinright", dur: 2, dist: 40 }}><img src={SG_ART.flourishRight} alt="" /></El>
    <El x={21} y={56} w={79} h={41} m={{ x: 31 }} appear={{ style: "fadeinleft", dur: 2, dist: 40 }}><img src={SG_ART.flourishLeft} alt="" /></El>
  </Artboard>;
}
