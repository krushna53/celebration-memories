import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getInviteeByToken } from "@/services/invitees";
import { logInviteOpened } from "@/services/tracking";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { SITE_URL } from "@/lib/constants";
import { buildEventMetadata } from "@/lib/event-metadata";
import { computeRsvpPrice } from "@/lib/rsvp-pricing";
import { listScheduleItems } from "@/services/event-day";
import { RsvpForm } from "@/features/rsvp/rsvp-form";
import { MediaUploadsSection } from "@/features/uploads/media-uploads-section";
import { EngagementOptInBanner } from "@/features/push/engagement-opt-in-banner";
import { GuestReelSection } from "@/features/reels/guest-reel-section";
import { areGuestReelsEnabled, getInviteeReelOptIn } from "@/services/guest-reels";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { SiteShell } from "@/components/layout/site-shell";
import { getSegmentCopy } from "@/lib/event-segment";
import { getRsvpConfig } from "@/services/rsvp-config";
import { PoweredByBand } from "@/features/event-landing/powered-by-band";
import { WhatsAppContactButton } from "@/features/event-landing/whatsapp-contact-button";

// Always dynamic: every request must re-check the token and re-log a
// visit, so this route is never statically generated or cached.
export const dynamic = "force-dynamic";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

// cache() dedupes this within a single request — generateMetadata and
// the page component both need the invitee, but should only fetch once.
const loadInvitee = cache((token: string) => getInviteeByToken(token));

// So pasting a personal invite link into WhatsApp/iMessage shows the
// organizer's link preview image (see lib/event-metadata.ts) instead of
// a bare URL — previously this route had no metadata at all.
export async function generateMetadata({
  params,
}: InvitePageProps): Promise<Metadata> {
  const { token } = await params;
  const found = await loadInvitee(token);
  return buildEventMetadata(found?.event ?? null);
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const found = await loadInvitee(token);

  if (!found) {
    notFound();
  }

  const { invitee, event, existingRsvp } = found;
  const rsvpPrice = computeRsvpPrice(event);
  // "Relive the day" once the event is over: thank-you copy, uploads first, no RSVP form.
  const ended = Date.parse(event.endAt) < Date.now();
  const workshopSessions = (await listScheduleItems(event.id)).filter(
    (item) => item.requiresRegistration,
  );
  const reelsEnabled = await areGuestReelsEnabled(event.id);
  const reelOptIn = reelsEnabled && !ended ? await getInviteeReelOptIn(invitee.id) : null;

  const requestHeaders = await headers();
  await logInviteOpened(invitee.id, {
    userAgent: requestHeaders.get("user-agent"),
    referral: requestHeaders.get("referer"),
  });

  const guestCopy = getSegmentCopy(event.category).guest;
  const rsvpConfig = await getRsvpConfig(event.id);

  return (
    <SiteShell
      honoreeName={event.honoreeName}
      footerVariant="minimal"
      homeHref={`/events/${event.slug}`}
    >
      <EngagementOptInBanner token={token} honoreeName={event.honoreeName} />
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-gold-500">
              {ended
                ? guestCopy.thankYou
                : `${event.hostedBy} warmly invites`}
            </p>
            <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
              {invitee.name}
            </h1>
            <p className="mt-3 text-sm text-navy-700/80 sm:text-base">
              {ended
                ? guestCopy.endedInviteLine(event.honoreeName, event.eventTitle)
                : guestCopy.inviteLine(event.honoreeName, event.eventTitle)}
            </p>
            <div className="divider-gold mx-auto mt-6 w-20" />
            <p className="mt-6 text-sm tracking-wide text-navy-700/70">
              {formatEventDate(event.startAt, event.timezone)}
              <br />
              {formatEventTimeRange(event, event.timezone)}
            </p>
          </Reveal>
        </div>

        {!ended ? (
          <div className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
            <WhatsAppContactButton eventId={event.id} eventName={event.eventTitle || event.honoreeName} variant="inline" />
            <Reveal delay={0.1}>
              <RsvpForm
                token={token}
                eventId={event.id}
                inviteeId={invitee.id}
                guestName={invitee.name}
                rsvpPrice={rsvpPrice}
                workshopSessions={workshopSessions}
                reminderMessage={guestCopy.rsvpReminder}
                rsvpConfig={rsvpConfig}
                reelSelfie={
                  reelOptIn
                    ? {
                        photoUrl: reelOptIn.photoUrl,
                        honoreeName: event.honoreeName,
                        hostedBy: event.hostedBy,
                      }
                    : undefined
                }
                story={{
                  card: {
                    eyebrow: "I'm going!",
                    title: event.honoreeName,
                    subtitle: event.eventTitle,
                    details: [
                      formatEventDate(event.startAt, event.timezone),
                      formatEventTimeRange(event, event.timezone),
                      ...(event.venueName ? [event.venueName] : []),
                    ],
                  },
                  shareText: `${guestCopy.shareText(event.honoreeName, event.eventTitle)} ${SITE_URL}/events/${event.slug}`,
                }}
                defaultValues={
                  existingRsvp
                    ? {
                        coming: existingRsvp.coming,
                        adults: existingRsvp.adults,
                        children: existingRsvp.children,
                        mealPreference: existingRsvp.mealPreference,
                        comments: existingRsvp.comments ?? "",
                        answers: existingRsvp.answers ?? undefined,
                        phone: invitee.phone ?? "",
                        email: invitee.email ?? "",
                      }
                    : {
                        phone: invitee.phone ?? "",
                        email: invitee.email ?? "",
                      }
                }
              />
            </Reveal>
          </div>
        ) : null}

        {ended && reelsEnabled ? (
          <GuestReelSection
            token={token}
            inviteeId={invitee.id}
            guestName={invitee.name}
            honoreeName={event.honoreeName}
            hostedBy={event.hostedBy}
            category={event.category}
          />
        ) : null}

        <div
          id="share"
          className={
            ended
              ? "mx-auto mt-12 max-w-xl px-4 sm:px-6"
              : "mx-auto mt-16 max-w-xl px-4 sm:px-6"
          }
        >
          <Reveal>
            <SectionHeading
              eyebrow={
                ended ? guestCopy.uploadsEyebrowAfter : guestCopy.uploadsEyebrow
              }
              title={ended ? "Add Your Photos & Videos" : guestCopy.uploadsTitle}
              description={
                ended
                  ? "Photos from your phone or Google Photos, videos, a voice message, or a note — everything you captured on the day."
                  : guestCopy.uploadsDescription
              }
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <MediaUploadsSection token={token} />
          </Reveal>
        </div>
      </div>
      <PoweredByBand eventId={event.id} />
    </SiteShell>
  );
}
