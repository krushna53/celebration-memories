import { Users } from "lucide-react";

import { listAllRsvps } from "@/services/rsvp-config";
import { groupComingResponses, type RsvpConfig } from "@/lib/rsvp-config";

/**
 * "Who's coming" under the homepage RSVP (RsvpConfig.showResponses): the
 * names of guests who said yes, grouped by the date/session (or other
 * first multiple-choice answer) they picked. Names only — never phone,
 * email or comments.
 */
export async function RsvpResponsesList({ eventId, config }: { eventId: string; config: RsvpConfig }) {
  const { question, groups } = groupComingResponses(config, (await listAllRsvps(eventId)).reverse()); // oldest first, so a family reads in the order it was typed
  const total = groups.reduce((sum, g) => sum + g.names.length, 0);

  return (
    <div className="mt-8 rounded-3xl border border-gold-500/25 bg-white/80 p-5 text-left shadow-sm sm:p-8">
      <h3 className="flex items-center gap-2 font-display text-xl text-navy-950">
        <Users size={20} className="text-gold-600" aria-hidden="true" />
        Who&rsquo;s coming
        <span className="ml-auto rounded-full bg-gold-500/10 px-3 py-0.5 font-sans text-sm text-gold-700">{total}</span>
      </h3>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-navy-700/80">No replies yet — be the first!</p>
      ) : (
        <div className="mt-4 grid gap-4">
          {groups.map((group) => (
            <section key={group.label ?? "_none"} aria-label={group.label ?? "Other replies"}>
              <p className="flex items-baseline justify-between gap-3 text-sm font-medium text-navy-950">
                <span>{group.label ?? (question ? "Didn’t pick yet" : "Attending")}</span>
                <span className="shrink-0 text-xs text-navy-700/70">{group.names.length}</span>
              </p>
              {group.names.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {group.names.map((name, i) => (
                    <li key={`${name}-${i}`} className="rounded-full border border-navy-950/10 bg-ivory-50 px-3 py-1 text-sm text-navy-800">
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-navy-700/60">No one yet</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
