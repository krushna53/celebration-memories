import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getSegmentCopy } from "@/lib/event-segment";
import { listMilestones } from "@/services/timeline";
import { TimelineManager } from "@/features/admin/timeline/timeline-manager";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { SkipStepLink } from "@/features/start/skip-step-link";
import {
  draftCreateMilestoneAction,
  draftDeleteMilestoneAction,
  draftUpdateMilestoneAction,
  draftRequestTimelineImageUploadUrlAction,
  draftConfirmTimelineImageUploadAction,
  draftRemoveTimelineImageAction,
  draftDescribePhotoPlaceAction,
  draftSuggestTimelineFromPhotosAction,
  draftAddMilestonePhotosAction,
  draftRemoveMilestonePhotoAction,
  draftGetTimelineFingerprintsAction,
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
      goals={event.wizardGoals}
      category={event.category}
      title="Timeline"
      description={getSegmentCopy(event.category).timelineStepDescription}
      headerAction={<SkipStepLink token={token} slug="timeline" goals={event.wizardGoals} />}
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
          describePlace: draftDescribePhotoPlaceAction.bind(null, token),
          suggestFromPhotos: draftSuggestTimelineFromPhotosAction.bind(null, token),
          addPhotos: draftAddMilestonePhotosAction.bind(null, token),
          removePhoto: draftRemoveMilestonePhotoAction.bind(null, token),
          getFingerprints: draftGetTimelineFingerprintsAction.bind(null, token),
        }}
      />
    </WizardStepShell>
  );
}
