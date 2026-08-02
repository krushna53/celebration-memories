import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { getEventByPlannerToken, listPlannerTasks, listPlannerNotes } from "@/services/event-planner";
import { PlannerPublicClient } from "@/features/plan/planner-public-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event Planner",
  robots: { index: false, follow: false },
};

export default async function PublicPlannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getEventByPlannerToken(token);

  if (!event) {
    return (
      <SiteShell honoreeName="EveryMoment" footerVariant="minimal">
        <div className="bg-ivory-50 px-4 py-24 text-center">
          <h1 className="font-display text-2xl text-navy-950">Link not valid</h1>
          <p className="mt-2 text-sm text-navy-700/60">
            This planning link isn&rsquo;t valid, or it&rsquo;s been reset by the host. Ask them for a new one.
          </p>
        </div>
      </SiteShell>
    );
  }

  const [tasks, notes] = await Promise.all([listPlannerTasks(event.id), listPlannerNotes(event.id)]);

  return (
    <SiteShell honoreeName={event.honoreeName} footerVariant="minimal">
      <div className="bg-ivory-50 px-4 py-10 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-gold-600">Planning Together</p>
            <h1 className="mt-1 font-display text-2xl text-navy-950">
              {event.honoreeName}&rsquo;s {event.eventTitle}
            </h1>
          </div>
          <PlannerPublicClient token={token} tasks={tasks} notes={notes} />
        </div>
      </div>
    </SiteShell>
  );
}
