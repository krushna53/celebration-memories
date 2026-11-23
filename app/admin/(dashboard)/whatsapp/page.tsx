import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getEventById } from "@/services/events";
import { SITE_URL } from "@/lib/constants";
import { whatsappEnvStatus } from "@/lib/whatsapp-cloud/config";
import { eventDisplayName } from "@/lib/whatsapp-cloud/event-messages";
import {
  getWhatsAppHealth,
  getWhatsAppPlatformSettings,
  getWhatsAppStatusCounts,
  listWhatsAppMessages,
  whatsappSendingAvailable,
  type WhatsAppLogScope,
} from "@/services/whatsapp";
import { PlatformWhatsAppManager } from "@/features/admin/whatsapp/platform-manager";
import { WhatsAppLogFiltersForm, WhatsAppMessageTable, WhatsAppStats, parseLogFilters } from "@/features/admin/whatsapp/message-log";

export const dynamic = "force-dynamic";

function when(iso: string | null): string {
  return iso ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso)) : "Never";
}

/**
 * WhatsApp Cloud API — owner-only platform integration page: connection
 * and webhook health, the master switch, template mapping, test sends,
 * and message stats. Stats are aggregate across events; the message list
 * only shows test sends and events the platform account owns itself
 * (customer events' guest data stays behind their own login).
 */
export default async function AdminWhatsAppPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const filters = parseLogFilters(await searchParams);
  const scope: WhatsAppLogScope = { platform: true, ownedEventIds: admin.ownedEventIds };
  const env = whatsappEnvStatus();
  const [settings, health, counts, messages, canSend, ownedEvents] = await Promise.all([
    getWhatsAppPlatformSettings(),
    getWhatsAppHealth(),
    getWhatsAppStatusCounts(filters, scope),
    listWhatsAppMessages(filters, scope),
    whatsappSendingAvailable(),
    Promise.all(admin.ownedEventIds.map((id) => getEventById(id))),
  ]);

  const statusRows: Array<{ label: string; value: string; ok: boolean }> = [
    { label: "Server switch (WHATSAPP_ENABLED)", value: env.enabled ? "On" : "Off", ok: env.enabled },
    { label: "Owner switch", value: settings.enabled ? "On" : "Off", ok: settings.enabled },
    { label: "Test mode", value: env.testMode ? "On — test recipients only" : "Off — live", ok: true },
    { label: "Graph API version", value: env.apiVersion, ok: true },
    { label: "Phone number ID", value: env.phoneNumberId ?? "Not set", ok: Boolean(env.phoneNumberId) },
    { label: "Credentials", value: env.problems.length ? `Missing/invalid: ${env.problems.join(", ")}` : "All set", ok: env.problems.length === 0 },
    { label: "Last webhook received", value: when(health.lastWebhookAt), ok: Boolean(health.lastWebhookAt) },
    { label: "Last successful send", value: when(health.lastSuccessAt), ok: Boolean(health.lastSuccessAt) },
    {
      label: "Last API error",
      value: health.lastError ? `${when(health.lastError.at)} — ${health.lastError.code ?? ""} ${health.lastError.title ?? ""}` : "None",
      ok: !health.lastError,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">WhatsApp API</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Meta&rsquo;s official WhatsApp Cloud API for invitations, RSVP confirmations and reminders. Credentials live only in the server&rsquo;s
        environment variables — nothing secret is shown or stored here.
      </p>

      <div className="mt-6 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Status</h2>
        <dl className="mt-3 divide-y divide-navy-950/5 text-sm">
          {statusRows.map((row) => (
            <div key={row.label} className="flex flex-wrap justify-between gap-2 py-2">
              <dt className="text-navy-700/70">{row.label}</dt>
              <dd className={row.ok ? "text-navy-950" : "text-amber-700"}>{row.value}</dd>
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-2 py-2">
            <dt className="text-navy-700/70">Webhook callback URL</dt>
            <dd className="font-mono text-xs text-navy-950">{SITE_URL}/api/whatsapp/webhook</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <PlatformWhatsAppManager settings={settings} canSend={canSend} />
      </div>

      <h2 className="mt-10 font-display text-lg text-navy-950">Messages</h2>
      <p className="mt-1 text-sm text-navy-700/60">Counts cover every event. The list shows test sends and your own events only.</p>
      <div className="mt-4 space-y-4">
        <WhatsAppLogFiltersForm
          filters={filters}
          events={ownedEvents.flatMap((e) => (e ? [{ id: e.id, name: eventDisplayName(e) }] : []))}
        />
        <WhatsAppStats counts={counts} />
        <WhatsAppMessageTable messages={messages} showEvent />
      </div>
    </div>
  );
}
