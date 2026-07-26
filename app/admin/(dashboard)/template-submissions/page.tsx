import { redirect } from "next/navigation";

import { listTemplateSubmissions } from "@/services/template-submissions";
import { getCurrentAdmin } from "@/services/admin-auth";
import { TemplateSubmissionList } from "@/features/admin/template-submissions/template-submission-list";

export const dynamic = "force-dynamic";

export default async function AdminTemplateSubmissionsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const submissions = await listTemplateSubmissions();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Template Submissions</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Community-contributed templates from the public &ldquo;Submit a Template&rdquo;
        page. Approving one makes it render live on any event that selects it, with
        credit shown to the contributor.
      </p>
      <div className="mt-6">
        <TemplateSubmissionList initialSubmissions={submissions} />
      </div>
    </div>
  );
}
