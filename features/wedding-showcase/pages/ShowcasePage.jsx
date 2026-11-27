"use client";
import "@/features/sacred-garden/components/garden/sacred-fonts.css";
import { useRef } from "react";
import { useAutoScroll } from "@/features/sacred-garden/components/garden/useAutoScroll";
import { useReveal, RsvpSlot } from "./parts";
import Editorial from "./Editorial";
import RoyalScroll from "./RoyalScroll";
import BoardingPass from "./BoardingPass";
import Scrapbook from "./Scrapbook";
import Celestial from "./Celestial";
import ModernGrid from "./ModernGrid";
import Arches from "./Arches";
import Kit, { DESIGNS } from "./Kit";
import FloralInvitation from "./FloralInvitation";
import SheeshMahalPage from "./SheeshMahalPage";
import p from "./parts.module.css";

const LAYOUTS = { editorial: Editorial, scroll: RoyalScroll, ticket: BoardingPass, scrapbook: Scrapbook, celestial: Celestial, modern: ModernGrid, arches: Arches, floralinvite: FloralInvitation, sheeshmahal: SheeshMahalPage };

// Devanagari / Gujarati / Bengali fall back to fonts that have those letters
const stack = (family, last) => `"${family}", "Tiro Devanagari Hindi", "Nirmala UI", "Noto Sans Gujarati", ${last}`;

/**
 * A sample wedding website's page in one of the showcase layouts (the seven hand-built ones here, or a Kit design) (the Sacred Garden page is the other choice and lives
 * in features/sacred-garden). layout: a key of LAYOUTS; c: content from buildInvitation();
 * active: the opening has gone, so motion can start; autoScroll: glide through the sections;
 * rsvp: true = the design's own RSVP form, false = none, or a node (the event's live RSVP) in its place.
 */
export default function ShowcasePage({ layout, c, active = true, autoScroll = false, rsvp = true }) {
  const root = useRef(null);
  useReveal(root, active);
  useAutoScroll(active && autoScroll, root);
  const Layout = LAYOUTS[layout];
  const k = c.colors, f = c.fonts;
  const vars = {
    "--pg-accent": k.accent, "--pg-ink": k.text, "--pg-bg": k.background, "--pg-detail": k.detail, "--pg-time": k.time, "--pg-button": k.button,
    "--pg-script": stack(f.script, "cursive"), "--pg-names": stack(f.names, "cursive"), "--pg-serif": stack(f.body, "Georgia, serif"), "--pg-body-style": f.bodyStyle,
  };
  return <div ref={root} className={p.page} style={vars} data-layout={layout}>
    <RsvpSlot.Provider value={rsvp}>{Layout ? <Layout c={c} active={active} /> : <Kit c={c} design={DESIGNS[layout] ? layout : "pearl"} />}</RsvpSlot.Provider>
  </div>;
}
