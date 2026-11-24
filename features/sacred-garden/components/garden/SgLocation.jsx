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

// name + address stay inside the visible screen: phones narrower than the 450px column crop its edges
const TEXT_BOX = { left: "max(35px, calc(241px - 50vw))", width: "min(380px, calc(100vw - 32px))" };

/** Venue name and address under a small ornament, with a picture of the place (a photo runs the full width) and falling petals. */
export default function SgLocation({ id = "sg-location", title = "Location", name, address, image, vignette = false, petals = SG_ART.petals }) {
  const up = { style: "fadeinup", dur: 2, dist: 40 };
  // a long name or address wraps; every extra line moves the picture down so they never overlap.
  // letters a line: 34 / 46 in the 380px column, 26 / 34 on the narrowest phones (see TEXT_BOX)
  const extraLines = (text, perLine) => Math.max(0, Math.ceil((text?.length ?? 0) / perLine) - 1);
  const shift = extraLines(name, 34) * 31 + extraLines(address, 46) * 21;
  const mShift = extraLines(name, 26) * 31 + extraLines(address, 34) * 21;
  const base = image && vignette ? 484 : 421;
  return <Artboard id={id} height={base + shift} mHeight={base + mShift} pt={30} label="Location">
    <El x={175} y={81} w={96} h={30} appear={{ style: "zoomin", dur: 3, scale: 0.9 }}><img src={SG_ART.decor} alt="" /></El>
    {image && (vignette
      ? <El x={0} y={184 + shift} m={{ y: 184 + mShift }} w={450} h={300} appear={{ style: "fadein", dur: 1 }}><img className={s.photo} src={image} alt="" loading="lazy" /></El>
      : <El x={35} y={174 + shift} m={{ y: 174 + mShift }} w={380} h={253} appear={{ style: "zoomin", dur: 1, scale: 0.9 }}><img className={s.drawing} src={image} alt="" loading="lazy" /></El>)}
    {PETALS.map(([x, y, w, h, m, path], i) => <El key={i} x={x} y={y} w={w} h={h} m={m} z={4}
      steps={{ ev: "blockintoview", trg: 1, list: [{}, ...path] }}>
      <img src={petals[i % petals.length]} alt="" />
    </El>)}
    <El x={35} y={111} w={380} h={73 + shift} m={{ h: 73 + mShift }} style={TEXT_BOX} appear={up}>
      <p className={`${g.text} ${g.body} ${s.name}`}>{name}</p>
      <p className={`${g.text} ${g.body} ${s.address}`}>{address}</p>
    </El>
    <El x={-55} y={28} w={560} h={64}><h2 className={`${g.text} ${g.title}`}>{title}</h2></El>
  </Artboard>;
}
