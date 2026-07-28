import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { listApprovedTemplateSubmissions } from "@/services/template-submissions";
import { communitySubmissionToTemplateSummary } from "@/lib/community-theme";
import { TEMPLATE_CATALOG } from "@/lib/template-catalog";
import { TemplatePicker, type PickerTemplate } from "@/features/admin/templates/template-picker";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { draftUpdateEventAction } from "@/features/start/actions/event";

export const dynamic = "force-dynamic";

export default async function WizardTemplatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [event, approvedSubmissions] = await Promise.all([
    getDraftEventByToken(token),
    listApprovedTemplateSubmissions(),
  ]);
  if (!event) notFound();

  const templates: PickerTemplate[] = [
    ...TEMPLATE_CATALOG,
    ...approvedSubmissions.map(communitySubmissionToTemplateSummary),
  ];

  return (
    <WizardStepShell
      token={token}
      slug="template"
      goals={event.wizardGoals}
      title="Template"
      description="Choose the look of your site. Every template uses the same sections — only colours, fonts, and animation style change."
    >
      <TemplatePicker
        eventId={event.id}
        currentTemplateSlug={event.templateSlug}
        templates={templates}
        updateAction={draftUpdateEventAction.bind(null, token)}
      />
    </WizardStepShell>
  );
}
