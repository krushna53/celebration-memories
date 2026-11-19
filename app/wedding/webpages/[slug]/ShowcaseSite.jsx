"use client";
import { useMemo, useState } from "react";
import { InviteShell, CreateButton, VelvetCurtainIntro, CurtainIntro, SageDoorIntro, IntroCover, MusicToggle, useInviteMusic } from "@/features/sacred-garden/components";
import { SacredGardenInvitation, SgEnvelope, gardenTheme } from "@/features/sacred-garden/components/garden";
import { ENVELOPE_VIDEO } from "@/features/sacred-garden/lib/sacred-garden";
import { LIGHT_BURST_SEAL } from "@/features/sacred-garden/lib/envelope-seal-track";
import { PlatformChromeProvider } from "@/components/layout/platform-chrome";
import { buildShowcase, SEAL_TINTS } from "@/features/wedding-showcase/showcase-sites";
import ShowcaseIntro from "@/features/wedding-showcase/ShowcaseIntro";
import s from "./showcase.module.css";

/** One sample wedding website: its own opening (envelope, curtain, doors or none) onto the Sacred Garden page. */
export default function ShowcaseSite({ site }) {
  const c = useMemo(() => buildShowcase(site), [site]);
  const [opened, setOpened] = useState(site.style === "none");
  const music = useInviteMusic({ src: c.music || undefined });
  const names = `${c.couple.first} & ${c.couple.second}`;
  const intro = { onOpen: music.play, onDone: () => setOpened(true) };
  const cover = { monogram: c.monogram, kicker: "THE WEDDING OF", guestLine: names, ...intro };
  const envelope = { music: c.music || undefined, tapLabel: c.envelope.tapLabel, autoOpen: c.envelope.autoOpen, theme: gardenTheme(c), onDone: () => setOpened(true) };

  let opening = null;
  switch (site.style) {
    case "film": opening = <SgEnvelope video={c.envelope.video} desktopVideo={c.envelope.desktopVideo} {...envelope} />; break;
    // the plain film with the couple's letters painted on its seal, the wax turned to the sample's colour
    case "seal": opening = <div className={s.tint} style={{ "--tint": `${SEAL_TINTS[site.tint] ?? 0}deg` }}>
      <SgEnvelope video={ENVELOPE_VIDEO} monogram={c.monogram} sealTrack={LIGHT_BURST_SEAL} {...envelope} />
    </div>; break;
    case "velvet": opening = <VelvetCurtainIntro names={names} fabric={site.fabric} {...intro} />; break;
    case "petals": opening = <div style={site.curtain}><CurtainIntro {...cover} /></div>; break;
    case "sage": opening = <SageDoorIntro names={names} {...intro} />; break;
    case "monogram": opening = <div style={site.doors}><IntroCover {...cover} /></div>; break;
    case "none": break;
    default: opening = <ShowcaseIntro variant={site.style} colors={site.colors} monogram={c.monogram} names={names} date={c.hero.date} {...intro} />;
  }

  // the floating buttons in the couple's colours; no "Install the app" prompt over the sample
  return <PlatformChromeProvider hidden><InviteShell locked={!opened} theme={{ "--inv-accent": c.colors.button, "--inv-accent-bright": c.colors.accent, "--inv-deep": c.colors.accent }}>
    {opening}
    <SacredGardenInvitation c={c} autoScroll={opened && c.autoScroll} />
    {/* the envelope brings its own music button; the other openings use this one */}
    {opened && site.group !== "envelope" && c.music && <MusicToggle className={s.music} playing={music.playing} onToggle={music.toggle} />}
    {opened && <a className={s.back} href="/wedding/webpages">← All designs</a>}
    {opened && <CreateButton />}
  </InviteShell></PlatformChromeProvider>;
}
