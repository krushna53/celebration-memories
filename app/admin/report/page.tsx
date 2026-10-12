import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { getDashboardStats } from "@/services/admin-stats";
import { getFirstOpensByDay } from "@/services/event-report";
import { formatCalendarDate } from "@/lib/timezone";
import { getEventSegment } from "@/lib/event-segment";
import { formatEventDate, formatEventTimeRange } from "@/lib/timezone";
import { PrintButton } from "@/features/admin/report/print-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Event Report — EveryMoment",
  robots: { index: false, follow: false },
};

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

/**
 * One-page, print-ready summary of an event's numbers — the same data as
 * the admin Overview (services/admin-stats.ts), laid out for a host or
 * organiser to save as PDF and send to whoever they ran the event for.
 * Deliberately outside the (dashboard) layout so nothing but the report
 * prints. Same access rule as Overview: the event the admin is managing,
 * never a session organizer.
 */
export default async function AdminReportPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role === "session_organizer") redirect("/admin/my-sessions");

  const event = await resolveAdminEvent(admin);
  if (!event) redirect("/admin");

  const [stats, opensByDay] = await Promise.all([
    getDashboardStats(event.id),
    getFirstOpensByDay(event.id, event.timezone),
  ]);
  const recentOpens = opensByDay.slice(-10);
  const maxOpens = Math.max(1, ...recentOpens.map((d) => d.count));
  const { invitations: inv, uploads } = stats;
  const corporate = getEventSegment(event.category) === "corporate";
  const people = corporate ? "Attendees" : "Guests";
  const responded = inv.coming + inv.maybe + inv.declined;
  const totalUploads = uploads.photos + uploads.videos + uploads.audio + uploads.messages;

  const sections: { title: string; rows: { label: string; value: string; note?: string }[] }[] = [
    {
      title: "Invitations",
      rows: [
        { label: "Invitations sent", value: String(inv.total) },
        { label: "Opened", value: String(inv.opened), note: `${percent(inv.opened, inv.total)} open rate` },
        { label: "Responded", value: String(responded), note: `${percent(responded, inv.total)} RSVP rate` },
      ],
    },
    {
      title: "RSVPs",
      rows: [
        { label: "Coming", value: String(inv.coming) },
        { label: "Maybe", value: String(inv.maybe) },
        { label: "Not coming", value: String(inv.declined) },
        { label: "No response", value: String(inv.pending) },
      ],
    },
    {
      title: "Attendance",
      rows: [
        { label: "Checked in", value: String(inv.checkedIn), note: `${percent(inv.checkedIn, inv.coming)} of those who said yes` },
      ],
    },
    {
      title: "Engagement",
      rows: [
        { label: "Photos", value: String(uploads.photos) },
        { label: "Videos", value: String(uploads.videos) },
        { label: "Voice messages", value: String(uploads.audio) },
        { label: "Written messages", value: String(uploads.messages) },
        { label: "Total shared", value: String(totalUploads) },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-ivory-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-navy-700/70 hover:text-navy-950">
            <ArrowLeft size={15} /> Back to dashboard
          </Link>
          <PrintButton />
        </div>

        <article className="rounded-2xl border border-navy-950/10 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10">
          <header className="border-b border-navy-950/10 pb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-700">Event Report</p>
            <h1 className="mt-2 font-display text-3xl text-navy-950">{event.honoreeName}</h1>
            <p className="mt-1 text-navy-700/80">{event.eventTitle}</p>
            <p className="mt-3 text-sm text-navy-700/60">
              {formatEventDate(event.startAt, event.timezone)} · {formatEventTimeRange(event, event.timezone)}
              {event.venueName ? ` · ${event.venueName}` : ""}
            </p>
            <p className="mt-1 text-sm text-navy-700/60">Hosted by {event.hostedBy}</p>
          </header>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title} className="break-inside-avoid">
                <h2 className="font-display text-lg text-navy-950">{section.title}</h2>
                <dl className="mt-3 divide-y divide-navy-950/5">
                  {section.rows.map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-4 py-2 text-sm">
                      <dt className="text-navy-700/80">
                        {row.label}
                        {row.note ? <span className="block text-xs text-navy-700/50">{row.note}</span> : null}
                      </dt>
                      <dd className="font-display text-xl tabular-nums text-navy-950">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          {recentOpens.length > 0 ? (
            <section className="mt-8 break-inside-avoid">
              <h2 className="font-display text-lg text-navy-950">When invites were first opened</h2>
              <p className="mt-1 text-xs text-navy-700/50">
                {opensByDay.length > recentOpens.length ? `Last ${recentOpens.length} days with opens` : "Each day with opens"}
              </p>
              <ul className="mt-3 grid gap-1.5">
                {recentOpens.map((d) => (
                  <li key={d.day} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <span className="text-navy-700/80">{formatCalendarDate(d.day)}</span>
                    <span className="h-2.5 rounded-full bg-gold-500/80 print:bg-gold-500" style={{ width: `${(d.count / maxOpens) * 100}%` }} />
                    <span className="text-right tabular-nums text-navy-950">{d.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-8 break-inside-avoid">
            <h2 className="font-display text-lg text-navy-950">Most Active {people}</h2>
            {stats.mostActiveGuests.length === 0 ? (
              <p className="mt-3 text-sm text-navy-700/50">No visits recorded yet.</p>
            ) : (
              <ol className="mt-3 divide-y divide-navy-950/5">
                {stats.mostActiveGuests.slice(0, 5).map((g, i) => (
                  <li key={g.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-navy-950">
                      {i + 1}. {g.name}
                    </span>
                    <span className="text-navy-700/60">{g.visitCount} visits</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <footer className="mt-10 border-t border-navy-950/10 pt-4 text-xs text-navy-700/50">
            Generated {formatEventDate(new Date().toISOString(), event.timezone)} with EveryMoment · Figures are live
            from the event dashboard.
          </footer>
        </article>
      </div>
    </div>
  );
}
