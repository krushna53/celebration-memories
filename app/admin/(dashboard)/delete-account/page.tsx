import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { DeleteAccountForm } from "@/features/admin/delete-account/delete-account-form";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  if (!admin || admin.role !== "client") {
    return (
      <p className="text-navy-700">
        This page is only available to a client (event host) account — the owner account can&rsquo;t be deleted this
        way.
      </p>
    );
  }

  const event = await resolveAdminEvent(admin);
  if (!event) {
    return <p className="text-navy-700">No event is linked to this account.</p>;
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Delete Account</h1>
      <p className="mt-1 text-sm text-navy-700/60">Permanently remove your login and everything in your event.</p>
      <div className="mt-6">
        <DeleteAccountForm eventTitle={event.eventTitle} honoreeName={event.honoreeName} />
      </div>
    </div>
  );
}
