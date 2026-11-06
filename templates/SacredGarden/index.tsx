import type { BirthdayTemplateProps } from "@/lib/templates";
import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { formDefaults, SAMPLE_SITES } from "@/features/sacred-garden/lib/invitation-form";
import SacredGardenEvent from "./SacredGardenEvent";
import { EditDesignButton } from "./edit-design-button";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import { WhatsAppContactButton } from "@/features/event-landing/whatsapp-contact-button";

/** Envelope films we already have, by the initials on their wax seal. */
const FILMS: Record<string, string> = { "K & A": SAMPLE_SITES["sample-photo"].envelopeFilm };

/** "2026-11-23T13:00:00Z" in the event's timezone → "2026-11-23T18:30" (the Sacred Garden form's date). */
function localDateTime(iso: string, timeZone: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Sacred Garden (moved from krushna-53-invitations): its own full page, not the shared section stack.
 * The couple ("Kunal & Aanchal"), date, venue and dress code come from the event; everything else is the design's sample text.
 */
export default function SacredGarden({ event, displayData, galleryPhotos, milestones }: BirthdayTemplateProps) {
  const rawName = event?.honoreeName ?? displayData.honoreeName;
  // a fresh draft is called "New Event" until the host names it; show the sample couple instead
  const coupleName = rawName.trim() === "New Event" ? "" : rawName;
  const [groom = "", bride = ""] = coupleName.split(/\s*(?:&|\band\b)\s*/i);
  const form = {
    ...formDefaults,
    groom: groom.trim() || formDefaults.groom,
    bride: bride.trim() || formDefaults.bride,
    date: event ? localDateTime(event.startAt, event.timezone || "Asia/Kolkata") : formDefaults.date,
    venueName: displayData.venueName || formDefaults.venueName,
    venueAddress: displayData.venueAddress || formDefaults.venueAddress,
    venueMap: [displayData.venueName, displayData.venueAddress].filter(Boolean).join(", ") || formDefaults.venueMap,
    dress: displayData.dressCode || formDefaults.dress,
  };
  const letters = `${form.groom[0]} & ${form.bride[0]}`.toUpperCase();
  const film = FILMS[letters];
  // the site's live RSVP (answers land in admin) takes the place of the design's own wax-seal RSVP
  const liveRsvp = (
    <>
      {event ? <WhatsAppContactButton eventId={event.id} eventName={event.eventTitle || event.honoreeName} /> : null}
      <RsvpTeaserSection eventId={event?.id} eventSlug={event?.slug} publicRsvpEnabled={event?.publicRsvpEnabled}
        honoreeName={event?.honoreeName} category={event?.category} />
    </>
  );
  // the site's own header and footer, like every template; sample events get the usual "Create your own" strip
  return (
    <SiteShell honoreeName={`${form.groom} & ${form.bride}`} transparentUntilScroll>
      {/* The garden design (with its own RSVP) is the hero; after it come the site's own sections (sample strip, gallery…).
          The design already shows the countdown, invitation, details and RSVP, so those are left out. */}
      <EventSections
        event={event}
        displayData={displayData}
        galleryPhotos={galleryPhotos}
        milestones={milestones}
        omitSections={["countdown", "invitation", "eventDetails", "rsvp", "gallery", "memoryWall"]}
        renderHero={() => <SacredGardenEvent form={film ? { ...form, envelopeFilm: film, envelopeLetters: letters } : form} rsvp={liveRsvp} />}
      />
      {event ? <EditDesignButton eventId={event.id} /> : null}
    </SiteShell>
  );
}
