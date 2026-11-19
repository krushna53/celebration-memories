"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { InviteShell } from "@/features/sacred-garden/components";
import { SacredGardenInvitation, SgEnvelope, gardenTheme } from "@/features/sacred-garden/components/garden";
import { buildInvitation } from "@/features/sacred-garden/lib/invitation-form";
import { SHOWCASE_SITES } from "@/features/wedding-showcase/showcase-sites";
import ShowcaseOpening from "@/features/wedding-showcase/ShowcaseOpening";
import ShowcasePage from "@/features/wedding-showcase/pages/ShowcasePage";
import "@/features/wedding-showcase/showcase-fonts.css";

/**
 * The Sacred Garden page for one event: the envelope film (when one carries these initials) opens onto the garden.
 * @param {{ form: any, rsvp?: import("react").ReactNode }} props rsvp: true = the design's own, false = none, or a node in its place
 */
export default function SacredGardenEvent({ form, rsvp = true }) {
  const [opened, setOpened] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  // back from Google sign-in on the RSVP (its return link ends in #rsvp): no envelope film again, straight to the RSVP
  const [returning, setReturning] = useState(false);
  useLayoutEffect(() => { if (window.location.hash === "#rsvp") setReturning(true); }, []);
  useEffect(() => {
    if (!returning || !opened) return undefined;
    // the RSVP loads the guest's reply after mount and the garden art settles, so line it up again once things have grown
    const go = () => document.getElementById("rsvp")?.scrollIntoView({ block: "start", behavior: "instant" });
    const timers = [0, 400, 1200].map((ms) => window.setTimeout(go, ms));
    return () => timers.forEach(window.clearTimeout);
  }, [returning, opened]);
  const c = useMemo(() => buildInvitation(form), [form]);
  // the auto-scroll follows the music: play scrolls, pause stops; the guest's own scrolling stops it until they press play
  const onMusic = useCallback((on) => { setMusicOn(on); if (on) setHandedOver(false); }, []);
  // a design picked in the wedding gallery: its own opening and page instead of the envelope film and garden
  const showcase = SHOWCASE_SITES.find((site) => site.slug === form.showcase);
  if (showcase && !["film", "seal"].includes(showcase.style)) {
    const covered = showcase.style !== "none" && !opened && !returning;
    return <InviteShell locked={covered}>
      {covered && <ShowcaseOpening site={showcase} c={c} onDone={() => setOpened(true)} />}
      {showcase.page === "garden"
        ? <SacredGardenInvitation c={c} rsvp={rsvp} />
        : <ShowcasePage layout={showcase.page} c={c} rsvp={rsvp} active={!covered} autoScroll={c.autoScroll && !handedOver} />}
    </InviteShell>;
  }
  const scrolling = c.autoScroll && (opened || !c.envelope.ready) && (musicOn || !c.music) && !handedOver && !returning;
  return <InviteShell locked={c.envelope.ready && !opened}>
    {c.envelope.ready && <SgEnvelope video={c.envelope.video} desktopVideo={c.envelope.desktopVideo} music={c.music || undefined} tapLabel={c.envelope.tapLabel} monogram={c.monogram} sealTrack={c.envelope.sealTrack}
      sealImage={c.envelope.sealImage} autoOpen={c.envelope.autoOpen} skip={returning} theme={gardenTheme(c)} onDone={() => setOpened(true)} onMusic={onMusic} />}
    <SacredGardenInvitation c={c} rsvp={rsvp} autoScroll={scrolling} onScrollTakeover={() => setHandedOver(true)} />
  </InviteShell>;
}
