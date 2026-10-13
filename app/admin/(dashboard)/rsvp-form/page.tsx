import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { getRsvpConfig, listRsvpAnswers } from "@/services/rsvp-config";
import { getEventSegment } from "@/lib/event-segment";
import { ATTENDANCE_LABELS, type AttendanceOption } from "@/types/rsvp";
import { AdminRsvpFormBuilder } from "@/features/admin/rsvp-form/admin-rsvp-form-builder";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

/** Configure the event's RSVP form (lib/rsvp-config.ts) and read answers to its custom questions. */
export default async function AdminRsvpFormPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) return <NoEventState />;

  const [config, answers] = await Promise.all([getRsvpConfig(event.id), listRsvpAnswers(event.id)]);
  const questions = config.questions;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">RSVP Form</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Choose what your RSVP form asks — on personal invite links, the shared RSVP link and the event page. Changes
        apply straight away; answers already given are kept.
      </p>
      <div className="mt-6">
        <AdminRsvpFormBuilder eventId={event.id} initialConfig={config} corporate={getEventSegment(event.category) === "corporate"} />
      </div>

      {questions.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-navy-950">Answers to your questions</h2>
          {answers.length === 0 ? (
            <p className="mt-3 text-sm text-navy-700/60">No answers yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-navy-950/5 text-xs uppercase tracking-wide text-navy-700/60">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">RSVP</th>
                    {questions.map((q) => (
                      <th key={q.id} className="px-4 py-3">
                        {q.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-950/5">
                  {answers.map((row, i) => (
                    <tr key={`${row.name}-${i}`}>
                      <td className="px-4 py-3 font-medium text-navy-950">{row.name}</td>
                      <td className="px-4 py-3 text-navy-700/80">
                        {config.attendanceLabels[row.coming as AttendanceOption] || ATTENDANCE_LABELS[row.coming as AttendanceOption] || row.coming}
                      </td>
                      {questions.map((q) => (
                        <td key={q.id} className="px-4 py-3 text-navy-700/80">
                          {row.answers[q.id] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
