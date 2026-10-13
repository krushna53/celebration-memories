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
      <p className="mt-2 max-w-3xl text-sm text-navy-700/60">
        Built one yourself (a demo, or for a client)? Your platform account can&rsquo;t own or publish customer events.
        Use <strong className="text-navy-950">Continue editing</strong> to finish it, then{" "}
        <strong className="text-navy-950">Copy host link</strong> and send it to the person who&rsquo;ll run the event — they
        sign in or create an account, become its owner, and publish it from their own login.
      </p>
      <div className="mt-6">
        <DraftList initialDrafts={drafts} />
      </div>
    </div>
  );
}
