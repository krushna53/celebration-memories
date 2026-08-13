import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { getScheduleItemByShareToken } from "@/services/event-day";
import { getEventById } from "@/services/events";
import { SessionShareGate } from "@/features/session-share/session-share-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Session Registration",
  robots: { index: false, follow: false },
};

/**
 * Public, per-session guest-facing page (#106) — the single-session
 * sibling of /event-day/[token], reached via a link a session organizer
 * shares just for their own session (e.g. one paid workshop slot)
 * rather than the event's whole schedule/menu.
 */
export default async function SessionSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getScheduleItemByShareToken(token);
  const event = session ? await getEventById(session.eventId) : null;

  if (!session || !event) {
    return (
      <SiteShell honoreeName="EveryMoment" footerVariant="minimal">
        <div className="bg-ivory-50 px-4 py-24 text-center">
          <h1 className="font-display text-2xl text-navy-950">Link not valid</h1>
          <p className="mt-2 text-sm text-navy-700/60">
            This link isn&rsquo;t valid, or it&rsquo;s been reset by the host. Ask them for a new one.
          </p>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell honoreeName={event.honoreeName} footerVariant="minimal" homeHref={`/events/${event.slug}`}>
      <SessionShareGate token={token} honoreeName={event.honoreeName} />
    </SiteShell>
  );
}
