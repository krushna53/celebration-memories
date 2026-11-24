import { redirect } from "next/navigation";

import { adminForEvent, getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import {
  getEventWhatsAppSettings,
  getWhatsAppStatusCounts,
  listWhatsAppGuests,
  listWhatsAppMessages,
  whatsappSendingAvailable,
} from "@/services/whatsapp";
import { NoEventState } from "@/features/admin/components/no-event-state";
import { EventWhatsAppManager } from "@/features/admin/whatsapp/event-manager";
import { WhatsAppLogFiltersForm, WhatsAppMessageTable, WhatsAppStats, parseLogFilters } from "@/features/admin/whatsapp/message-log";

export const dynamic = "force-dynamic";

/**
 * One event's WhatsApp: automation toggles, guest consent, invitation
 * sends, and this event's message log. Owner (own events) and client
 * hosts only — every read is scoped to this event's id, and every action
 * re-checks requireAdminForEvent.
 */
export default async function AdminEventWhatsAppPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!admin || !event) return <NoEventState />;
  const scoped = adminForEvent(admin, event.id);
  if (!scoped || (scoped.role !== "owner" && scoped.role !== "client")) redirect("/admin");

  const filters = { ...parseLogFilters(await searchParams), eventId: null };
  const scope = { eventId: event.id };
  const [settings, guests, counts, messages, sendingAvailable] = await Promise.all([
    getEventWhatsAppSettings(event.id),
    listWhatsAppGuests(event.id),
    getWhatsAppStatusCounts(filters, scope),
    listWhatsAppMessages(filters, scope),
    whatsappSendingAvailable(),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">WhatsApp</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Send invitations, RSVP confirmations and reminders for {event.honoreeName}&rsquo;s event from EveryMoment&rsquo;s official WhatsApp
        number — only to guests who&rsquo;ve agreed to it. (The tap-to-send links on Invitees still work as before.)
      </p>

      <div className="mt-6">
        <EventWhatsAppManager settings={settings} guests={guests} sendingAvailable={sendingAvailable} />
      </div>

      <h2 className="mt-10 font-display text-lg text-navy-950">Messages</h2>
      <div className="mt-4 space-y-4">
        <WhatsAppLogFiltersForm filters={filters} />
        <WhatsAppStats counts={counts} />
        <WhatsAppMessageTable messages={messages} showEvent={false} />
      </div>
    </div>
  );
}
