import { MessageCircleQuestion } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getEventBySlug } from "@/services/events";
import { formatEventDate, formatEventTime } from "@/lib/format";
import { PublicRsvpForm } from "@/features/rsvp/public-rsvp-form";
import { Reveal } from "@/components/motion/reveal";
import { SiteShell } from "@/components/layout/site-shell";

export const dynamic = "force-dynamic";

interface PublicRsvpPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PublicRsvpPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  return { title: event ? `RSVP — ${event.honoreeName}'s ${event.eventTitle}` : "RSVP" };
}

/**
 * Self-service RSVP page — no invite token needed. Only usable when an
 * admin has flipped "Allow public RSVP" on in Event Settings
 * (events.public_rsvp_enabled); otherwise shows guidance to use a
 * personal invite link instead of a dead end. See services/public-rsvp.ts
 * for how a guest's phone number is used to find or create their
 * invitee record without a token.
 */
export default async function PublicRsvpPage({ params }: PublicRsvpPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  return (
    <SiteShell honoreeName={event.honoreeName}>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.35em] text-gold-500">
              {event.hostedBy} warmly invites
            </p>
            <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
              {event.honoreeName}&rsquo;s {event.eventTitle || event.occasion}
            </h1>
            <div className="divider-gold mx-auto mt-6 w-20" />
            <p className="mt-6 text-sm tracking-wide text-navy-700/70">
              {formatEventDate(event.startAt)}
              <br />
              {formatEventTime(event.startAt)} &ndash; {formatEventTime(event.endAt)}
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-12 max-w-xl px-4 sm:px-6">
          {event.publicRsvpEnabled ? (
            <Reveal delay={0.1}>
              <PublicRsvpForm eventSlug={slug} honoreeName={event.honoreeName} />
            </Reveal>
          ) : (
            <Reveal delay={0.1}>
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold-500/15 bg-white px-8 py-12 text-center shadow-sm">
                <MessageCircleQuestion className="text-gold-500" size={32} />
                <h3 className="font-display text-xl text-navy-950">
                  This event uses personal invitations
                </h3>
                <p className="max-w-sm text-sm text-navy-700/75">
                  {event.hostedBy} sends each guest their own invitation link by
                  WhatsApp or email — please use that link to RSVP. If you
                  haven&rsquo;t received one, reach out to {event.hostedBy}{" "}
                  directly.
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
