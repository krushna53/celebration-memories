import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listAdmins } from "@/services/admin-users";
import { listAllActiveEvents } from "@/services/events";
import { MemberList } from "@/features/admin/members/member-list";

export const dynamic = "force-dynamic";

/**
 * Owner-only directory of everyone who can sign in to the admin
 * dashboard at all — every row in the `admins` table. Not to be
 * confused with Invitees (event guests, no login, see /admin/invitees).
 */
export default async function AdminMembersPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const [members, events] = await Promise.all([listAdmins(), listAllActiveEvents()]);
  const eventOptions = events.map((event) => ({ id: event.id, label: event.honoreeName }));

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Members</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Everyone with a dashboard login — you (owner) and every client host.
        This is separate from Invitees, which is your event guest list and
        has no login at all.
      </p>
      <div className="mt-6">
        <MemberList initialMembers={members} events={eventOptions} />
      </div>
    </div>
  );
}
