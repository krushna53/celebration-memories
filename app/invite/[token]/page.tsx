import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getInviteeByToken } from "@/services/invitees";
import { logInviteOpened } from "@/services/tracking";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { SITE_URL } from "@/lib/constants";
import { buildEventMetadata } from "@/lib/event-metadata";
import { computeRsvpPrice } from "@/lib/rsvp-pricing";
import { listScheduleItems } from "@/services/event-day";
import { RsvpForm } from "@/features/rsvp/rsvp-form";
import { MediaUploadsSection } from "@/features/uploads/media-uploads-section";
import { EngagementOptInBanner } from "@/features/push/engagement-opt-in-banner";
import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { SiteShell } from "@/components/layout/site-shell";

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

  const requestHeaders = await headers();
  await logInviteOpened(invitee.id, {
    userAgent: requestHeaders.get("user-agent"),
    referral: requestHeaders.get("referer"),
  });

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
                ? "Thank you for celebrating with us"
                : `${event.hostedBy} warmly invites`}
            </p>
            <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
              {invitee.name}
            </h1>
            <p className="mt-3 text-sm text-navy-700/80 sm:text-base">
              {ended
                ? `Thank you for being part of ${event.honoreeName}'s ${event.eventTitle}. Add the photos and videos you took below.`
                : `to celebrate ${event.honoreeName}'s ${event.eventTitle}`}
            </p>
            <div className="divider-gold mx-auto mt-6 w-20" />
            <p className="mt-6 text-sm tracking-wide text-navy-700/70">
              {formatEventDate(event.startAt, event.timezone)}
              <br />
              {formatEventTime(event.startAt, event.timezone)} &ndash;{" "}
              {formatEventTime(event.endAt, event.timezone)}
            </p>
          </Reveal>
        </div>

        {!ended ? (
          <div className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
            <Reveal delay={0.1}>
              <RsvpForm
                token={token}
                eventId={event.id}
                inviteeId={invitee.id}
                guestName={invitee.name}
                rsvpPrice={rsvpPrice}
                workshopSessions={workshopSessions}
                story={{
                  card: {
                    eyebrow: "I'm going!",
                    title: event.honoreeName,
                    subtitle: event.eventTitle,
                    details: [
                      formatEventDate(event.startAt, event.timezone),
                      `${formatEventTime(event.startAt, event.timezone)} – ${formatEventTime(event.endAt, event.timezone)}`,
                      ...(event.venueName ? [event.venueName] : []),
                    ],
                  },
                  shareText: `I'm celebrating ${event.honoreeName}'s ${event.eventTitle} 🎉 ${SITE_URL}/events/${event.slug}`,
                }}
                defaultValues={
                  existingRsvp
                    ? {
                        coming: existingRsvp.coming,
                        adults: existingRsvp.adults,
                        children: existingRsvp.children,
                        mealPreference: existingRsvp.mealPreference,
                        comments: existingRsvp.comments ?? "",
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
                ended ? "After The Celebration" : "Add To The Celebration"
              }
              title={ended ? "Add Your Photos & Videos" : "Share Your Memories"}
              description={
                ended
                  ? "Photos from your phone or Google Photos, videos, a voice message, or a note — everything you captured on the day."
                  : "Photos, videos, a voice message, or a written note — however you'd like to celebrate."
              }
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-8">
            <MediaUploadsSection token={token} />
          </Reveal>
        </div>
      </div>
    </SiteShell>
  );
}
