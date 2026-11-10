"use client";
import { useCallback, useMemo, useState } from "react";
import { InviteShell } from "@/features/sacred-garden/components";
import { SacredGardenInvitation, SgEnvelope, gardenTheme } from "@/features/sacred-garden/components/garden";
import { buildInvitation } from "@/features/sacred-garden/lib/invitation-form";

/**
 * The Sacred Garden page for one event: the envelope film (when one carries these initials) opens onto the garden.
 * @param {{ form: any, rsvp?: import("react").ReactNode }} props rsvp: true = the design's own, false = none, or a node in its place
 */
export default function SacredGardenEvent({ form, rsvp = true }) {
  const [opened, setOpened] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  const c = useMemo(() => buildInvitation(form), [form]);
  // the auto-scroll follows the music: play scrolls, pause stops; the guest's own scrolling stops it until they press play
  const onMusic = useCallback((on) => { setMusicOn(on); if (on) setHandedOver(false); }, []);
  const scrolling = c.autoScroll && (opened || !c.envelope.ready) && (musicOn || !c.music) && !handedOver;
  return <InviteShell locked={c.envelope.ready && !opened}>
    {c.envelope.ready && <SgEnvelope video={c.envelope.video} desktopVideo={c.envelope.desktopVideo} music={c.music || undefined} tapLabel={c.envelope.tapLabel} monogram={c.monogram} sealTrack={c.envelope.sealTrack}
      sealImage={c.envelope.sealImage} autoOpen={c.envelope.autoOpen} theme={gardenTheme(c)} onDone={() => setOpened(true)} onMusic={onMusic} />}
    <SacredGardenInvitation c={c} rsvp={rsvp} autoScroll={scrolling} onScrollTakeover={() => setHandedOver(true)} />
  </InviteShell>;
}
