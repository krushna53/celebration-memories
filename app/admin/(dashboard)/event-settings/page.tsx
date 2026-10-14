import { redirect } from "next/navigation";

import { publicMediaUrl } from "@/services/uploads";
import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectOrganizerAway, shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { AI_CSS_CONFIGURED } from "@/lib/ai-css";
import { countAiCssGenerations } from "@/services/ai-css-generations";
import { getEventStorageUsage } from "@/services/storage-usage";
import { EventSettingsForm } from "@/features/admin/event-settings/event-settings-form";
import { NoEventState } from "@/features/admin/components/no-event-state";
import { HonoreeReelPhotoCard } from "@/features/admin/reels/honoree-reel-photo-card";
import { getReelSettings } from "@/services/guest-reels";
import { CobrandCard } from "@/features/admin/event-settings/cobrand-card";
import { getEventOwnCobrand } from "@/services/event-cobrand";
import { getBrandForEvent } from "@/services/host-brands";
import { WhatsAppContactCard } from "@/features/admin/event-settings/whatsapp-contact-card";
import { CardArtworkCard } from "@/features/admin/event-settings/card-artwork-card";
import { getCardArtworkUrl } from "@/services/card-artwork";
import { PaymentDetailsCard } from "@/features/admin/event-settings/payment-details-card";
import { getPaymentDetails } from "@/services/payment-details";
import { getEventWhatsAppContact } from "@/services/event-extras";
import { getEventSegment } from "@/lib/event-segment";

export const dynamic = "force-dynamic";

export default async function AdminEventSettingsPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  if (admin && shouldRedirectOrganizerAway(admin.role)) redirect("/admin/invitees");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const [cobrand, hostBrand, whatsapp, artworkUrl, payment] = await Promise.all([
    getEventOwnCobrand(event.id),
    getBrandForEvent(event.id),
    getEventWhatsAppContact(event.id),
    getCardArtworkUrl(event.id),
    getPaymentDetails(event.id),
  ]);
  const shareImageUrl = event.shareImagePath ? publicMediaUrl("gallery", event.shareImagePath) : null;
  const shareVideoUrl = event.shareVideoPath ? publicMediaUrl("gallery", event.shareVideoPath) : null;
  const highlightReelUrl = event.highlightReelPath
    ? publicMediaUrl("gallery", event.highlightReelPath)
    : null;

  const isClient = admin?.role === "client";
  const aiCssUsed = isClient ? await countAiCssGenerations(event.id) : 0;
  const aiCssLimit = event.aiCssGenerationLimit;
  const storageUsage = await getEventStorageUsage(event);
  const reelSettings = await getReelSettings(event.id);

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
          canEditStorageQuota={admin?.role === "owner"}
        />
      </div>
      <HonoreeReelPhotoCard
        eventId={event.id}
        honoreeName={event.honoreeName}
        photoUrl={reelSettings.honoreePhotoUrl}
        category={event.category}
      />
      <PaymentDetailsCard
        eventId={event.id}
        eventSlug={event.slug}
        initialText={payment?.text ?? ""}
        initialImageUrl={payment?.imageUrl ?? null}
      />
      <CardArtworkCard eventId={event.id} eventSlug={event.slug} artworkUrl={artworkUrl} hasCard={Boolean(event.shareImagePath)} />
      <WhatsAppContactCard
        eventId={event.id}
        initialNumber={whatsapp?.number ?? ""}
        initialLabel={whatsapp?.label ?? ""}
        corporate={getEventSegment(event.category) === "corporate"}
      />
      <CobrandCard
        eventId={event.id}
        initialName={cobrand?.name ?? ""}
        initialUrl={cobrand?.url ?? ""}
        inheritedBrandName={hostBrand?.displayName ?? null}
      />
    </div>
  );
}
