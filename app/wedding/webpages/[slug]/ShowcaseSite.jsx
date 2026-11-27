"use client";
import "@/features/wedding-showcase/showcase-fonts.css";
import { useMemo, useState } from "react";
import { InviteShell, MusicToggle, useInviteMusic } from "@/features/sacred-garden/components";
import { SacredGardenInvitation } from "@/features/sacred-garden/components/garden";
import { PlatformChromeProvider } from "@/components/layout/platform-chrome";
import { buildShowcase } from "@/features/wedding-showcase/showcase-sites";
import ShowcaseOpening from "@/features/wedding-showcase/ShowcaseOpening";
import ShowcasePage from "@/features/wedding-showcase/pages/ShowcasePage";
import UseDesignButton from "@/features/wedding-showcase/UseDesignButton";
import s from "./showcase.module.css";

/** One sample wedding website: its own opening (envelope, curtain, doors or none) onto its page design (site.page). */
export default function ShowcaseSite({ site }) {
  const c = useMemo(() => buildShowcase(site), [site]);
  const [opened, setOpened] = useState(site.style === "none");
  const music = useInviteMusic({ src: c.music || undefined });

  // the floating buttons in the couple's colours; no "Install the app" prompt over the sample
  return <PlatformChromeProvider hidden><InviteShell locked={!opened} theme={{ "--inv-accent": c.colors.button, "--inv-accent-bright": c.colors.accent, "--inv-deep": c.colors.accent }}>
    <ShowcaseOpening site={site} c={c} onOpen={music.play} onDone={() => setOpened(true)} />
    {site.page === "garden"
      ? <SacredGardenInvitation c={c} autoScroll={opened && c.autoScroll} />
      : <ShowcasePage layout={site.page} c={c} active={opened} autoScroll={c.autoScroll} />}
    {/* the envelope film brings its own music button; the other openings use this one */}
    {opened && !["film", "seal"].includes(site.style) && c.music && <MusicToggle className={s.music} playing={music.playing} onToggle={music.toggle} />}
    {opened && <a className={s.back} href="/wedding/webpages">← All designs</a>}
    {/* starts the couple's own website from this design, in the editor */}
    {opened && <UseDesignButton slug={site.slug} />}
  </InviteShell></PlatformChromeProvider>;
}
