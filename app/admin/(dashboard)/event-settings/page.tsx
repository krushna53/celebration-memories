import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { publicMediaUrl } from "@/services/uploads";
import { getCurrentAdmin } from "@/services/admin-auth";
import { AI_CSS_CONFIGURED } from "@/lib/ai-css";
import { countAiCssGenerations } from "@/services/ai-css-generations";
import { EventSettingsForm } from "@/features/admin/event-settings/event-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminEventSettingsPage() {
  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return <p className="text-navy-700">No event found. Check your Supabase seed data.</p>;
  }

  const shareImageUrl = event.shareImagePath ? publicMediaUrl("gallery", event.shareImagePath) : null;
  const shareVideoUrl = event.shareVideoPath ? publicMediaUrl("gallery", event.shareVideoPath) : null;

  const admin = await getCurrentAdmin();
  const isClient = admin?.role === "client";
  const aiCssUsed = isClient ? await countAiCssGenerations(event.id) : 0;
  const aiCssLimit = event.aiCssGenerationLimit;

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
          aiCssConfigured={AI_CSS_CONFIGURED}
          aiCssQuota={isClient ? { used: aiCssUsed, limit: aiCssLimit } : null}
        />
      </div>
    </div>
  );
}
