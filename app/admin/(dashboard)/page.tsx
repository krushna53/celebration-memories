import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { getDashboardStats } from "@/services/admin-stats";
import { StatCard } from "@/features/admin/components/stat-card";
import { BarChart } from "@/features/admin/components/bar-chart";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
  }

  const stats = await getDashboardStats(event.id);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="font-display text-2xl text-navy-950">Overview</h1>
        <p className="mt-1 text-sm text-navy-700/60">{event.honoreeName} — {event.eventTitle}</p>
      </div>

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
                { label: "Coming", value: stats.invitations.coming, color: "#c9a227" },
                { label: "Maybe", value: stats.invitations.maybe, color: "#a9861e" },
                { label: "Declined", value: stats.invitations.declined, color: "#21395e" },
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
    </div>
  );
}
