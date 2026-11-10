import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listInviteesWithRsvp } from "@/services/admin-invitees";
import { getDashboardStats } from "@/services/admin-stats";
import { StatCard } from "@/features/admin/components/stat-card";
import { RsvpList } from "@/features/admin/rsvps/rsvp-list";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

/**
 * Read-only RSVP responses — the main page for the "reviewer" team role
 * (lib/admin-roles.ts's REVIEWER_ALLOWED_PATHS), who can see RSVPs but not
 * edit guests. Owners see it too; hosts manage guests on /admin/invitees.
 */
export default async function AdminRsvpsPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const [invitees, stats] = await Promise.all([listInviteesWithRsvp(event.id), getDashboardStats(event.id)]);
  const inv = stats.invitations;
  const comingDetails = invitees.filter((i) => i.rsvpStatus === "coming" && i.rsvpDetail);
  const adults = comingDetails.reduce((sum, i) => sum + (i.rsvpDetail?.adults ?? 0), 0);
  const children = comingDetails.reduce((sum, i) => sum + (i.rsvpDetail?.children ?? 0), 0);
  const responded = inv.coming + inv.maybe + inv.declined;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-navy-950">RSVPs</h1>
          <p className="mt-1 text-sm text-navy-700/60">Every guest&rsquo;s response for {event.honoreeName}.</p>
        </div>
        <Link
          href="/admin/report"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-navy-950/15 px-4 py-2 text-sm font-medium text-navy-700 transition-luxury duration-300 hover:border-navy-950/30 hover:text-navy-950"
        >
          <FileText size={15} /> Event Report
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Invitations" value={inv.total} />
        <StatCard
          label="Responded"
          value={responded}
          hint={inv.total > 0 ? `${Math.round((responded / inv.total) * 100)}% RSVP rate` : undefined}
        />
        <StatCard label="Coming" value={inv.coming} hint={`${adults} adults · ${children} children`} />
        <StatCard label="Maybe" value={inv.maybe} />
        <StatCard label="Declined" value={inv.declined} />
        <StatCard label="Pending" value={inv.pending} />
      </div>

      <RsvpList eventId={event.id} eventSlug={event.slug} invitees={invitees} />
    </div>
  );
}
