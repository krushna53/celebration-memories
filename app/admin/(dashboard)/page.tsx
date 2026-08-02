import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, Globe, LayoutGrid, MonitorPlay } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { getDashboardStats, getVisitorFunnel } from "@/services/admin-stats";
import { StatCard } from "@/features/admin/components/stat-card";
import { BarChart } from "@/features/admin/components/bar-chart";

export const dynamic = "force-dynamic";

interface AdminOverviewPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function AdminOverviewPage({ searchParams }: AdminOverviewPageProps) {
  const admin = await getCurrentAdmin();

  // Right after signing in (see app/admin/login/page.tsx's ?from=login),
  // a client-role admin lands on the simplified single-page view instead
  // of the full tab-heavy Overview — the owner's default is unchanged.
  // Deliberately gated on the query param rather than always redirecting
  // client-role admins away from /admin, since that would break the
  // "Overview" nav link and /admin/simple's own "Full Dashboard" link
  // for them (both point at plain /admin).
  const { from } = await searchParams;
  if (admin?.role === "client" && from === "login") {
    redirect("/admin/simple");
  }

  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const stats = await getDashboardStats(event.id);
  const funnel = await getVisitorFunnel(event.id, stats.invitations);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-navy-950">Overview</h1>
          <p className="mt-1 text-sm text-navy-700/60">{event.honoreeName} — {event.eventTitle}</p>
          <Link
            href="/admin/simple"
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-gold-700 underline underline-offset-4 hover:text-gold-800"
          >
            <LayoutGrid size={12} /> Prefer fewer tabs? Try the simplified view
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/events/${event.slug}`}
            target="_blank"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-navy-950/15 px-4 py-2 text-sm font-medium text-navy-700 transition-luxury duration-300 hover:border-navy-950/30 hover:text-navy-950"
          >
            <Globe size={15} /> Web Page
          </Link>
          <Link
            href={`/events/${event.slug}/rsvp`}
            target="_blank"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-navy-950/15 px-4 py-2 text-sm font-medium text-navy-700 transition-luxury duration-300 hover:border-navy-950/30 hover:text-navy-950"
          >
            <CalendarCheck size={15} /> RSVP Link
          </Link>
          <Link
            href={`/events/${event.slug}/display`}
            target="_blank"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gold-500/30 bg-navy-950 px-4 py-2 text-sm font-medium text-gold-300 transition-luxury duration-300 hover:brightness-125"
          >
            <MonitorPlay size={15} /> Open Big Screen Display
          </Link>
        </div>
      </div>
      <p className="-mt-4 text-xs text-navy-700/50">
        Web Page is the full site; RSVP Link opens the shared RSVP form if you&rsquo;ve turned it
        on (Event Settings); Big Screen Display is the chrome-free slideshow for a TV or projector
        at the venue.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Invitations" value={stats.invitations.total} />
        <StatCard label="Opened" value={stats.invitations.opened} />
        <StatCard label="Checked In" value={stats.invitations.checkedIn} />
        <StatCard label="Pending Approval" value={stats.uploads.pendingApproval} hint="photos/videos/audio/messages" />
        <StatCard label="Photos" value={stats.uploads.photos} />
        <StatCard label="Videos" value={stats.uploads.videos} />
        <StatCard label="Audio" value={stats.uploads.audio} />
        <StatCard label="Guestbook Messages" value={stats.uploads.messages} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg text-navy-950">RSVP Breakdown</h2>
          <div className="mt-4">
            <BarChart
              data={[
                { label: "Coming", value: stats.invitations.coming, color: "#ff6b57" },
                { label: "Maybe", value: stats.invitations.maybe, color: "#e5503c" },
                { label: "Declined", value: stats.invitations.declined, color: "#4f46e5" },
                { label: "Pending", value: stats.invitations.pending, color: "#c8c2ad" },
              ]}
            />
          </div>
        </div>

        <div className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg text-navy-950">Most Active Guests</h2>
          {stats.mostActiveGuests.length === 0 ? (
            <p className="mt-4 text-sm text-navy-700/50">No visits recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {stats.mostActiveGuests.map((g) => (
                <li key={g.id} className="flex items-center justify-between text-sm">
                  <span className="text-navy-950">{g.name}</span>
                  <span className="text-navy-700/50">{g.visitCount} visits</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-navy-950/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg text-navy-950">Visitor Funnel</h2>
        <p className="mt-1 text-xs text-navy-700/50">
          Page views → engaged with the RSVP form → submitted. A rough
          picture of where visitors drop off.
          {process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID
            ? " For the visual why (heatmaps, session recordings), check your Microsoft Clarity dashboard."
            : " Set up Microsoft Clarity (see README) for heatmaps and session recordings showing the visual why."}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Page Views" value={funnel.landingPageViews + funnel.publicRsvpPageViews} />
          <StatCard label="Engaged With RSVP Form" value={funnel.rsvpStarted} />
          <StatCard label="Submitted RSVP" value={funnel.rsvpSubmitted} />
          <StatCard
            label="Completion Rate"
            value={
              funnel.rsvpStarted > 0
                ? `${Math.round((funnel.rsvpSubmitted / funnel.rsvpStarted) * 100)}%`
                : "—"
            }
            hint="submitted ÷ engaged"
          />
        </div>
        <div className="mt-4">
          <BarChart
            data={[
              { label: "Page Views", value: funnel.landingPageViews + funnel.publicRsvpPageViews, color: "#4f46e5" },
              { label: "Engaged", value: funnel.rsvpStarted, color: "#e5503c" },
              { label: "Submitted", value: funnel.rsvpSubmitted, color: "#ff6b57" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
