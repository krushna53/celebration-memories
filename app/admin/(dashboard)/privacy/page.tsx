import { notFound, redirect } from "next/navigation";
import { getCurrentAdmin } from "@/services/admin-auth";
import { eventPermissions } from "@/services/event-access";
import { supportHistory } from "@/services/support-access";
import { PrivacyPanel } from "@/features/privacy/privacy-panel";
export const dynamic = "force-dynamic";
export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  const eventId = (await searchParams).event ?? admin.eventId;
  if (!eventId) return <p>Select your event to manage privacy.</p>;
  const access = await eventPermissions(eventId);
  if (!access.owner) notFound();
  return <div><h1 className="mb-6 font-display text-2xl">Event privacy & support access</h1><PrivacyPanel eventId={eventId} mode={access.event!.viewing_access} pinned={access.event!.public_access_pinned} isOwner {...await supportHistory(eventId)} /></div>;
}
