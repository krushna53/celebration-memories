"use client";
import { Artboard, El } from "./Artboard";
import g from "./garden.module.css";
import { SG_ART } from "./assets";
import s from "./SgLocation.module.css";

// petals drift down and fade once the section comes into view: [x, y, w, h, phone {x, y, h}, path]
const PETALS = [
  [360, 20, 41, 33, {}, [{ mx: 27, my: 163, ro: -6, ti: 3000 }, { mx: 60, my: 341, op: 0.8, ro: -7, ti: 3000 }, { mx: 77, my: 381, op: 0, ro: 2, ti: 2000 }]],
  [94, 11, 43, 36, { x: 102, h: 45 }, [{ mx: -39, my: 163, ro: -6, ti: 3000 }, { mx: -69, my: 341, op: 0.8, ro: 2, ti: 3000 }, { mx: -77, my: 381, op: 0, ro: 2, ti: 2000 }]],
  [27, 117, 42, 33, { x: 31, y: 127 }, [{ mx: 29, my: 73, ro: -6, ti: 3000 }, { mx: 57, my: 204, ro: -6, ti: 4000 }, { mx: 67, my: 224, op: 0, ro: -6, ti: 2000 }]],
  [392, 144, 38, 34, { h: 31 }, [{ mx: -39, my: 133, ro: -6, ti: 3000 }, { mx: -69, my: 221, ro: 2, ti: 3000 }, { mx: -99, my: 251, op: 0, ro: 2, ti: 2000 }]],
  [50, 260, 38, 35, { h: 50 }, [{ mx: 39, my: 83, op: 0, ro: -12, ti: 3000 }]],
  [315, 284, 42, 34, { h: 39 }, [{ mx: -39, my: 73, op: 0, ro: -6, ti: 2000 }]],
];

/** Venue name and address under a small ornament, with a picture of the place and falling petals. */
export default function SgLocation({ id = "sg-location", title = "Location", name, address, image, vignette = false, petals = SG_ART.petals }) {
  const up = { style: "fadeinup", dur: 2, dist: 40 };
  return <Artboard id={id} height={421} pt={30} label="Location">
    <El x={175} y={81} w={96} h={30} appear={{ style: "zoomin", dur: 3, scale: 0.9 }}><img src={SG_ART.decor} alt="" /></El>
    {image && <El x={35} y={174} w={380} h={253} appear={{ style: "zoomin", dur: 1, scale: 0.9 }}><img className={vignette ? s.photo : s.drawing} src={image} alt={name ?? ""} loading="lazy" /></El>}
    {PETALS.map(([x, y, w, h, m, path], i) => <El key={i} x={x} y={y} w={w} h={h} m={m} z={4}
      steps={{ ev: "blockintoview", trg: 1, list: [{}, ...path] }}>
      <img src={petals[i % petals.length]} alt="" />
    </El>)}
    <El x={109} y={111} w={232} h={31} appear={up}><p className={`${g.text} ${g.body} ${s.name}`}>{name}</p></El>
    <El x={71} y={149} w={308} h={42} appear={up}><p className={`${g.text} ${g.body} ${s.address}`}>{address}</p></El>
    <El x={-55} y={28} w={560} h={64}><h2 className={`${g.text} ${g.title}`}>{title}</h2></El>
  </Artboard>;
}
