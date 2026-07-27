import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { listMilestones } from "@/services/timeline";
import { TimelineManager } from "@/features/admin/timeline/timeline-manager";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import {
  draftCreateMilestoneAction,
  draftDeleteMilestoneAction,
  draftUpdateMilestoneAction,
  draftRequestTimelineImageUploadUrlAction,
  draftConfirmTimelineImageUploadAction,
  draftRemoveTimelineImageAction,
} from "@/features/start/actions/timeline";

export const dynamic = "force-dynamic";

export default async function WizardTimelinePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  const milestones = await listMilestones(event.id);

  return (
    <WizardStepShell
      token={token}
      slug="timeline"
      title="Timeline"
      description="Add the life milestones shown in your public Timeline section, in order."
    >
      <TimelineManager
        eventId={event.id}
        initialMilestones={milestones}
        actions={{
          createMilestone: draftCreateMilestoneAction.bind(null, token),
          updateMilestone: draftUpdateMilestoneAction.bind(null, token),
          deleteMilestone: draftDeleteMilestoneAction.bind(null, token),
          requestImageUpload: draftRequestTimelineImageUploadUrlAction.bind(null, token),
          confirmImageUpload: draftConfirmTimelineImageUploadAction.bind(null, token),
          removeImage: draftRemoveTimelineImageAction.bind(null, token),
        }}
      />
    </WizardStepShell>
  );
}
