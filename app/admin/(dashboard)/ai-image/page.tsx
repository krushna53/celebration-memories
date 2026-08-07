import { getTemplateBySlug } from "@/lib/templates";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { buildInvitationCardPrompt } from "@/lib/ai-image-prompt";
import { AI_IMAGE_CONFIGURED } from "@/lib/ai-image";
import { countAiImageGenerations } from "@/services/ai-image-generations";
import { getLatestCompletedAiImageJob, getLatestUploadedAiImageJob } from "@/services/ai-image-jobs";
import { publicMediaUrl } from "@/services/uploads";
import { AiImageGenerator } from "@/features/admin/ai-image/ai-image-generator";

export const dynamic = "force-dynamic";

// Available to owner and client roles (see lib/admin-roles.ts) — client
// usage is capped per event (events.ai_image_generation_limit) since
// this calls a real per-image-cost API; owner is exempt from the cap.
export default async function AdminAiImagePage() {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const template = getTemplateBySlug(event.templateSlug);
  const defaultPrompt = buildInvitationCardPrompt(event, template);

  const isClient = admin?.role === "client";
  const used = isClient ? await countAiImageGenerations(event.id) : 0;
  const limit = event.aiImageGenerationLimit;

  const [latestGeneratedJob, latestUploadedJob] = await Promise.all([
    getLatestCompletedAiImageJob(event.id),
    getLatestUploadedAiImageJob(event.id),
  ]);
  const initialGeneratedResult = latestGeneratedJob
    ? { url: publicMediaUrl("gallery", latestGeneratedJob.resultPath), path: latestGeneratedJob.resultPath }
    : null;
  const initialUploadedResult = latestUploadedJob
    ? { url: publicMediaUrl("gallery", latestUploadedJob.resultPath), path: latestUploadedJob.resultPath }
    : null;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">AI Image</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Describe an image and generate it with AI — for a link preview,
        gallery photo, or inspiration for your printed invitation.
      </p>
      {isClient ? (
        <p className="mt-2 text-xs text-navy-700/50">
          {Math.max(limit - used, 0)} of {limit} generations remaining for this event.
        </p>
      ) : (
        <p className="mt-2 text-xs text-navy-700/50">
          Real cost per generation applies — see the README for pricing.
        </p>
      )}
      <div className="mt-6">
        <AiImageGenerator
          eventId={event.id}
          defaultPrompt={defaultPrompt}
          configured={AI_IMAGE_CONFIGURED}
          quota={isClient ? { used, limit } : null}
          initialGeneratedResult={initialGeneratedResult}
          initialUploadedResult={initialUploadedResult}
          currentShareImagePath={event.shareImagePath}
        />
      </div>
    </div>
  );
}
