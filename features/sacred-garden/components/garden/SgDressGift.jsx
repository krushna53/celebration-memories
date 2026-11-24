"use client";
import { Artboard, El } from "./Artboard";
import g from "./garden.module.css";
import { SG_ART } from "./assets";
import s from "./SgDressGift.module.css";

const breathe = { ev: "blockintoview", trg: 1, loop: true, list: [{}, { sx: 1.02, ro: 1, ti: 2000 }, { ti: 2000 }, { sx: 0.98, ro: -1, ti: 2000 }, { ti: 2000 }] };
const breatheSmall = { ev: "blockintoview", trg: 1, loop: true, list: [{}, { sx: 1.04, ro: 1, ti: 1500 }, { sx: 0.98, ti: 1500 }, { sx: 0.98, ro: -2, ti: 1500 }, { ti: 1500 }] };

/**
 * Blocks split by a blank line whose first line is a short heading ("Haldi\nPink kurtas") show that heading as a gold
 * label above its line; a plain note is shown as typed.
 */
function dressBlocks(dress) {
  const blocks = dress.split(/\n\s*\n/).map((block) => block.split("\n"));
  if (!blocks.every((lines) => lines.length > 1 && lines[0].trim().length <= 40)) return dress;
  return blocks.map(([label, ...rest], i) => <span key={i} className={s.block}><span className={s.label}>{label.trim()}</span>{rest.join("\n")}</span>);
}

/**
 * Dress code and gift note on one torn-paper panel with bouquets at two corners.
 * The panel grows with longer text. Either part can be left out.
 */
export default function SgDressGift({ id = "sg-dress-gift", dressTitle = "Dress Code", dress, giftTitle = "Gift Preference", gift, paper = SG_ART.paperDress, bouquets = [SG_ART.bouquetDressSmall, SG_ART.bouquetDress] }) {
  const up = { style: "fadeinup", dur: 2, dist: 40 };
  return <Artboard id={id} height={491} auto label={dressTitle}>
    <El x={-147} y={20} w={744} h="calc(100% - 38px)" z={1}><img className={g.stretch} src={paper} alt="" /></El>
    <El x={283} y={9} w={305} h={401} m={{ x: 220, y: -1, w: 276, h: 363 }} z={3} steps={breathe}><img src={bouquets[1]} alt="" /></El>
    <div className={s.flow}>
      {dress && <>
        <h2 className={`${g.text} ${g.title} ${s.title}`}>{dressTitle}</h2>
        <El as="p" className={`${g.text} ${g.body} ${s.copy}`} appear={up} style={{ position: "relative", left: 0, top: 0, width: "auto" }}>{dressBlocks(dress)}</El>
      </>}
      {/* the small bouquet sits beside the gift title however long the dress note is; text stays on top of the flowers */}
      <div className={`${s.gift} ${dress ? s.second : ""}`}>
        <El x={-165} y={-34} w={251} h={240} m={{ x: -112 }} z={-1} steps={breatheSmall}><img src={bouquets[0]} alt="" /></El>
        {gift && <>
          <h2 className={`${g.text} ${g.title} ${s.title}`}>{giftTitle}</h2>
          <El as="p" className={`${g.text} ${g.body} ${s.copy}`} appear={up} style={{ position: "relative", left: 0, top: 0, width: "auto" }}>{gift}</El>
        </>}
      </div>
    </div>
  </Artboard>;
}
