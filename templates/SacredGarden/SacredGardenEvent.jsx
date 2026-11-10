"use client";
import { useMemo, useState } from "react";
import { InviteShell } from "@/features/sacred-garden/components";
import { SacredGardenInvitation, SgEnvelope, gardenTheme } from "@/features/sacred-garden/components/garden";
import { buildInvitation } from "@/features/sacred-garden/lib/invitation-form";

/**
 * The Sacred Garden page for one event: the envelope film (when one carries these initials) opens onto the garden.
 * @param {{ form: any, rsvp?: import("react").ReactNode }} props rsvp: true = the design's own, false = none, or a node in its place
 */
export default function SacredGardenEvent({ form, rsvp = true }) {
  const [opened, setOpened] = useState(false);
  const c = useMemo(() => buildInvitation(form), [form]);
  return <InviteShell locked={c.envelope.ready && !opened}>
    {c.envelope.ready && <SgEnvelope video={c.envelope.video} desktopVideo={c.envelope.desktopVideo} music={c.music || undefined} tapLabel={c.envelope.tapLabel} monogram={c.monogram} sealTrack={c.envelope.sealTrack}
      sealImage={c.envelope.sealImage} autoOpen={c.envelope.autoOpen} theme={gardenTheme(c)} onDone={() => setOpened(true)} />}
    <SacredGardenInvitation c={c} rsvp={rsvp} autoScroll={c.autoScroll && (opened || !c.envelope.ready)} />
  </InviteShell>;
}
