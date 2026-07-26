import { redirect } from "next/navigation";

import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { listInvitees } from "@/services/admin-invitees";
import { getCurrentAdmin } from "@/services/admin-auth";
import { CheckinManager } from "@/features/admin/checkin/checkin-manager";

export const dynamic = "force-dynamic";

export default async function AdminCheckinPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
  }

  const invitees = await listInvitees(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Event Day Check-In</h1>
      <p className="mt-1 text-sm text-navy-700/60">Search for a guest and check them in as they arrive.</p>
      <div className="mt-6">
        <CheckinManager initialInvitees={invitees} />
      </div>
    </div>
  );
}
