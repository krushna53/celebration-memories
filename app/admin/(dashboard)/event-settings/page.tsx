import { redirect } from "next/navigation";

import { publicMediaUrl } from "@/services/uploads";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { AI_CSS_CONFIGURED } from "@/lib/ai-css";
import { countAiCssGenerations } from "@/services/ai-css-generations";
import { getEventStorageUsage } from "@/services/storage-usage";
import { EventSettingsForm } from "@/features/admin/event-settings/event-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminEventSettingsPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <p className="text-navy-700">No event is assigned to this account yet. Clients: contact the site owner to get linked to your event. Owner: check your Supabase seed data.</p>;
  }

  const shareImageUrl = event.shareImagePath ? publicMediaUrl("gallery", event.shareImagePath) : null;
  const shareVideoUrl = event.shareVideoPath ? publicMediaUrl("gallery", event.shareVideoPath) : null;
  const highlightReelUrl = event.highlightReelPath
    ? publicMediaUrl("gallery", event.highlightReelPath)
    : null;

  const isClient = admin?.role === "client";
  const aiCssUsed = isClient ? await countAiCssGenerations(event.id) : 0;
  const aiCssLimit = event.aiCssGenerationLimit;
  const storageUsage = await getEventStorageUsage(event);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Event Settings</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        These details appear across the public site — hero, event details, and invite pages.
      </p>
      <div className="mt-6">
        <EventSettingsForm
          event={event}
          shareImageUrl={shareImageUrl}
          shareVideoUrl={shareVideoUrl}
          highlightReelUrl={highlightReelUrl}
          aiCssConfigured={AI_CSS_CONFIGURED}
          aiCssQuota={isClient ? { used: aiCssUsed, limit: aiCssLimit } : null}
          storageUsedBytes={storageUsage.totalBytes}
        />
      </div>
    </div>
  );
}
