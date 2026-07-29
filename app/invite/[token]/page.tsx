import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getInviteeByToken } from "@/services/invitees";
import { logInviteOpened } from "@/services/tracking";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { buildEventMetadata } from "@/lib/event-metadata";
import { RsvpForm } from "@/features/rsvp/rsvp-form";
import { MediaUploadsSection } from "@/features/uploads/media-uploads-section";
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
export async function generateMetadata({ params }: InvitePageProps): Promise<Metadata> {
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

  const requestHeaders = await headers();
  await logInviteOpened(invitee.id, {
    userAgent: requestHeaders.get("user-agent"),
    referral: requestHeaders.get("referer"),
  });

  return (
    <SiteShell honoreeName={event.honoreeName}>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-gold-500">
              {event.hostedBy} warmly invites
            </p>
            <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
              {invitee.name}
            </h1>
            <p className="mt-3 text-sm text-navy-700/80 sm:text-base">
              to celebrate {event.honoreeName}&rsquo;s {event.eventTitle}
            </p>
            <div className="divider-gold mx-auto mt-6 w-20" />
            <p className="mt-6 text-sm tracking-wide text-navy-700/70">
              {formatEventDate(event.startAt)}
              <br />
              {formatEventTime(event.startAt)} &ndash; {formatEventTime(event.endAt)}
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
          <Reveal delay={0.1}>
            <RsvpForm
              token={token}
              eventId={event.id}
              guestName={invitee.name}
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

        <div className="mx-auto mt-16 max-w-xl px-4 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Add To The Celebration"
              title="Share Your Memories"
              description="Photos, videos, a voice message, or a written note — however you'd like to celebrate."
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
