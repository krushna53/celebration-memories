import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listDraftEvents } from "@/services/event-drafts";
import { DraftList } from "@/features/admin/drafts/draft-list";

export const dynamic = "force-dynamic";

export default async function AdminDraftsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const drafts = await listDraftEvents();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Drafts</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        In-progress events started through the self-serve onboarding wizard
        (<code className="rounded bg-navy-950/5 px-1 py-0.5">/start</code>) but not yet paid
        for. These never auto-delete — remove them manually here.
      </p>
      <div className="mt-6">
        <DraftList initialDrafts={drafts} />
      </div>
    </div>
  );
}
