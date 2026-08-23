import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { countAiVideoGenerations, getAiVideoUrl } from "@/services/ai-video-jobs";
import { AiVideoGenerator } from "@/features/admin/ai-video/ai-video-generator";

export const dynamic = "force-dynamic";
export default async function AdminAiVideoPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) return <p className="text-navy-700">No event is assigned to this account yet.</p>;
  const isClient = admin?.role === "client";
  const [used, initialVideoUrl] = await Promise.all([isClient ? countAiVideoGenerations(event.id) : 0, getAiVideoUrl(event.id)]);
  return <div><h1 className="font-display text-2xl text-navy-950">AI Video</h1><p className="mt-1 text-sm text-navy-700/60">Turn a written idea into a short cinematic event video with OpenAI Sora.</p><div className="mt-6"><AiVideoGenerator eventId={event.id} quota={isClient ? { used, limit: event.aiVideoGenerationLimit } : null} initialVideoUrl={initialVideoUrl} /></div></div>;
}
