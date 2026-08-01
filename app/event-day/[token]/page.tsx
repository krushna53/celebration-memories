import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { getEventByEventDayToken } from "@/services/event-day";
import { EventDayGate } from "@/features/event-day/event-day-gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event Schedule & Menu",
  robots: { index: false, follow: false },
};

export default async function EventDayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getEventByEventDayToken(token);

  if (!event) {
    return (
      <SiteShell honoreeName="Celebration Memories" footerVariant="minimal">
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
    <SiteShell honoreeName={event.honoreeName} footerVariant="minimal">
      <EventDayGate token={token} honoreeName={event.honoreeName} />
    </SiteShell>
  );
}
