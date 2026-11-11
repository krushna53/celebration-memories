"use client";
import "./sacred-fonts.css";
import { useRef } from "react";
import { Artboard, El, useArtboardMotion } from "./Artboard";
import { useAutoScroll } from "./useAutoScroll";
import { SG_ART } from "./assets";
import SgHero from "./SgHero";
import SgCountdown from "./SgCountdown";
import SgSchedule from "./SgSchedule";
import SgLocation from "./SgLocation";
import SgMap from "./SgMap";
import SgDressGift from "./SgDressGift";
import SgRsvp from "./SgRsvp";
import SgClosing from "./SgClosing";
import SgHashtag from "./SgHashtag";
import g from "./garden.module.css";
import d from "./desktop.module.css";

/**
 * The Sacred Garden invitation: cover film with the names, welcome on torn paper, countdown,
 * schedule, location and map, dress code and gifts, a wax-seal RSVP and a closing photo or video.
 * c: content in the shape of lib/sacred-garden.js.
 * The motion starts as soon as the page loads (the opening envelope sits on top meanwhile).
 */
// Devanagari / Gujarati fall back to fonts that have those letters
const stack = (family, last) => `"${family}", "Tiro Devanagari Hindi", "Nirmala UI", "Noto Sans Gujarati", ${last}`;

/** The couple's fonts and colours as CSS variables, for the page and anything shown over it (RSVP pop-up, envelope). */
export function gardenTheme(c) {
  const f = c.fonts, k = c.colors;
  return {
    ...(f && { "--sg-script": stack(f.script, "cursive"), "--sg-names": stack(f.names, "cursive"), "--sg-serif": stack(f.body, "Georgia, serif"), "--sg-body-style": f.bodyStyle }),
    ...(k && { "--sg-gold": k.accent, "--sg-ink": k.text, "--sg-bg": k.background, "--sg-detail": k.detail, "--sg-time": k.time, "--sg-button": k.button }),
  };
}

/**
 * rsvp: true = the design's own RSVP; false = none; or a node shown in its place (the site's live RSVP form).
 * autoScroll: glide through the page now (see useAutoScroll); onScrollTakeover: the guest scrolled the page themselves.
 */
export default function SacredGardenInvitation({ c, rsvp = true, autoScroll = false, onScrollTakeover }) {
  const root = useRef(null);
  useArtboardMotion(root, true, c);
  useAutoScroll(autoScroll, root, onScrollTakeover);
  const theme = gardenTheme(c);
  // computers: the invitation as a framed card on a soft garden (desktop.module.css; phones see the page as is)
  return <div className={`${g.vars} ${d.card}`} style={{ ...theme, "--desk-art": `url("${c.hero.photo || SG_ART.couple}")` }}>
    <div className={d.backdrop} aria-hidden="true"><img src={SG_ART.bouquetHeroLeft} alt="" /><img src={SG_ART.bouquetHeroRight} alt="" /></div>
  <div ref={root} className={`${g.page} ${d.sheet}`}>
    <SgHero first={c.couple.first} second={c.couple.second} firstParents={c.couple.firstParents} secondParents={c.couple.secondParents} date={c.hero.date} weddingDay={c.hero.weddingDay} scrollLabel={c.hero.scrollLabel}
      video={c.hero.video} photo={c.hero.photo} blessing={c.welcome.blessing} blessingImage={c.welcome.blessingImage} title={c.welcome.title} message={c.welcome.message} nextId="sg-countdown" hashtag={c.hashtag} />
    <SgCountdown title={c.countdown.title} date={c.countdown.date} labels={c.countdown.labels} />
    <SgSchedule title={c.schedule.title} items={c.schedule.items} hashtag={c.hashtag} />
    <SgLocation title={c.location.title} name={c.location.name} address={c.location.address} image={c.location.image || SG_ART.venue} vignette={Boolean(c.location.image)} />
    <SgMap embedSrc={c.location.mapEmbed} directions={c.location.directions} title={c.location.name} />
    <SgDressGift dressTitle={c.dressCode.title} dress={c.dressCode.text} giftTitle={c.gifts.title} gift={c.gifts.text} />
    {rsvp !== true ? rsvp || null : <SgRsvp title={c.rsvp.title} text={c.rsvp.text} openLabel={c.rsvp.openLabel} note={c.rsvp.note} fields={c.rsvp.fields} endpoint={c.rsvp.endpoint}
      submit={c.rsvp.submit} required={c.rsvp.required} success={c.rsvp.success} failure={c.rsvp.failure} theme={theme} />}
    {/* under the RSVP (the design's own or the site's live form), when guests have just said they're coming */}
    {c.hashtag && <Artboard id="sg-hashtag" height={90} label="Hashtag">
      <El x={45} y={14} w={360} h={60}><SgHashtag tag={c.hashtag} lead="Share every moment with" /></El>
    </Artboard>}
    <SgClosing title={c.closing.title} names={c.couple.joined} date={c.hero.date} layout={c.closing.layout} photo={c.closing.photo || undefined} video={c.closing.video || undefined} hashtag={c.hashtag} />
  </div>
  </div>;
}
