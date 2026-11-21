"use client";
import { VelvetCurtainIntro, CurtainIntro, SageDoorIntro, IntroCover } from "@/features/sacred-garden/components";
import { SgEnvelope, gardenTheme } from "@/features/sacred-garden/components/garden";
import { ENVELOPE_VIDEO } from "@/features/sacred-garden/lib/sacred-garden";
import { LIGHT_BURST_SEAL } from "@/features/sacred-garden/lib/envelope-seal-track";
import { SEAL_TINTS, openingColors } from "./showcase-sites";
import ShowcaseIntro from "./ShowcaseIntro";
import EnvelopeIntro from "./EnvelopeIntro";
import Opening, { OPENINGS } from "./openings/Opening";
import RealOpening, { REAL_OPENINGS } from "./openings/RealOpening";
import { photoFor } from "./pages/parts";

const PAPER = ["pocket", "gatefold", "lasercut", "airmail"];
const DRAWN = ["rise", "sheer", "swag", "double", "marigold", "pearls", "temple", "jali", "haveli", "glass"];

/** Openings that can also be drawn as a small live thumbnail (the others get a static drawing on their card). */
export const canThumb = (style) => PAPER.includes(style) || DRAWN.includes(style) || OPENINGS.includes(style) || REAL_OPENINGS.includes(style);

/**
 * A sample's opening: its envelope, curtain or doors over the page (none for "none").
 * site: a showcase sample (style + its extra colours / fabric); c: content from buildInvitation();
 * onOpen: runs inside the tap (start the music); onDone: the page is uncovered.
 * thumb / play: draw it small on a card, opening while `play` (only for styles where canThumb() is true).
 */
// the couple's own fonts, so the opening's lettering matches the page behind it
const stack = (family, last) => `"${family}", "Tiro Devanagari Hindi", "Nirmala UI", ${last}`;

export default function ShowcaseOpening(props) {
  const { c } = props;
  if (props.site.style === "none") return null;
  return <div style={{ display: "contents", "--o-names": stack(c.fonts.names, "cursive"), "--o-serif": stack(c.fonts.body, "Georgia, serif") }}>
    <OpeningFor {...props} />
  </div>;
}

function OpeningFor({ site, c, onOpen, onDone, thumb = false, play = false }) {
  const names = `${c.couple.first} & ${c.couple.second}`;
  const intro = { onOpen, onDone };
  const cover = { monogram: c.monogram, kicker: "THE WEDDING OF", guestLine: names, ...intro };
  const envelope = { music: c.music || undefined, tapLabel: c.envelope.tapLabel, autoOpen: c.envelope.autoOpen, theme: gardenTheme(c), onDone };
  const shared = { colors: openingColors(site, c.colors), monogram: c.monogram, names, date: c.hero.date, thumb, play, ...intro };
  const style = site.style;
  if (style === "none") return null;
  if (PAPER.includes(style)) return <EnvelopeIntro variant={style} autoOpen={thumb ? 0 : c.envelope.autoOpen} {...shared} />;
  if (REAL_OPENINGS.includes(style)) return <RealOpening variant={style} {...shared} />;
  if (OPENINGS.includes(style)) return <Opening variant={style} photo={photoFor(c, 1)} {...shared} />;
  if (DRAWN.includes(style)) return <ShowcaseIntro variant={style} {...shared} />;
  switch (style) {
    case "film": return <SgEnvelope video={c.envelope.video} desktopVideo={c.envelope.desktopVideo} {...envelope} />;
    // the plain film with the couple's letters painted on its seal, the wax turned to the sample's colour
    case "seal": return <div style={{ filter: `hue-rotate(${SEAL_TINTS[site.tint] ?? 0}deg)` }}>
      <SgEnvelope video={ENVELOPE_VIDEO} monogram={c.monogram} sealTrack={LIGHT_BURST_SEAL} {...envelope} />
    </div>;
    case "velvet": return <VelvetCurtainIntro names={names} fabric={site.fabric} {...intro} />;
    case "petals": return <div style={site.curtain}><CurtainIntro {...cover} /></div>;
    case "sage": return <SageDoorIntro names={names} {...intro} />;
    case "monogram": return <div style={site.doors}><IntroCover {...cover} /></div>;
    default: return null;
  }
}
