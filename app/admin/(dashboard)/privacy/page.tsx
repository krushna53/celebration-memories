import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdmin } from "@/services/admin-auth";
import { eventPermissions } from "@/services/event-access";
import { supportHistory } from "@/services/support-access";
import { PrivacyPanel } from "@/features/privacy/privacy-panel";
export const dynamic = "force-dynamic";
export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  // Platform ownership is distinct from customer event ownership.
  // Offer the platform tools without reading customer privacy/support data.
  if (admin.role === "owner") return <div className="space-y-6 text-navy-950">
    <h1 className="font-display text-2xl">Privacy & support access</h1>
    <p>Event owners control who can view their event and approve temporary support access. Use these tools to manage public-link exceptions or request their approval.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Link href="/admin/public-event-links" className="rounded-xl border bg-white p-6 hover:border-gold-500">
        <h2 className="font-display text-xl">Public Event Links</h2>
        <p className="mt-2 text-sm">Choose which event links must remain public, including ongoing events.</p>
      </Link>
      <Link href="/admin/support-access" className="rounded-xl border bg-white p-6 hover:border-gold-500">
        <h2 className="font-display text-xl">Support Access</h2>
        <p className="mt-2 text-sm">Request temporary, read-only access from an event owner.</p>
      </Link>
    </div>
  </div>;
  const eventId = (await searchParams).event ?? admin.eventId;
  if (!eventId) return <p>Select your event to manage privacy.</p>;
  const access = await eventPermissions(eventId);
  if (!access.owner) {
    if (!access.manage) notFound();
    return <div className="space-y-4 text-navy-950"><h1 className="font-display text-2xl">Event privacy</h1><p>Only this event’s owner can change privacy settings or approve support access. Please ask the owner to open this page.</p><Link href="/admin" className="underline">Back to dashboard</Link></div>;
  }
  return <div><h1 className="mb-6 font-display text-2xl">Event privacy & support access</h1><PrivacyPanel eventId={eventId} mode={access.event!.viewing_access} pinned={access.event!.public_access_pinned} isOwner {...await supportHistory(eventId)} /></div>;
}
