import { maskPhone } from "@/lib/whatsapp-cloud/phone";
import {
  WHATSAPP_CATEGORIES,
  WHATSAPP_STATUSES,
  isWhatsAppCategory,
  type WhatsAppLogFilters,
  type WhatsAppMessageLog,
  type WhatsAppMessageStatus,
  type WhatsAppStatusCounts,
} from "@/lib/whatsapp-cloud/types";

/**
 * Stats cards + filters + message table, shared by the owner's
 * /admin/whatsapp and a host's /admin/event-whatsapp. A plain GET form
 * drives the filters (searchParams), so it's a Server Component.
 */

const STATUS_LABEL: Record<WhatsAppMessageStatus, string> = {
  queued: "Queued",
  sending: "Sending",
  accepted: "Accepted",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

const STATUS_TONE: Record<WhatsAppMessageStatus, string> = {
  queued: "bg-navy-950/5 text-navy-700",
  sending: "bg-navy-950/5 text-navy-700",
  accepted: "bg-sky-50 text-sky-700",
  sent: "bg-sky-50 text-sky-700",
  delivered: "bg-emerald-50 text-emerald-700",
  read: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-50 text-red-700",
};

const inputClasses =
  "mt-1 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-wide text-navy-700/50";

export function parseLogFilters(params: Record<string, string | string[] | undefined>): WhatsAppLogFilters {
  const one = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v ? v : null;
  };
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const status = one("status");
  const category = one("category");
  return {
    from: date(one("from")),
    to: date(one("to")),
    status: status && (WHATSAPP_STATUSES as readonly string[]).includes(status) ? (status as WhatsAppMessageStatus) : null,
    category: category && isWhatsAppCategory(category) ? category : null,
    eventId: one("event"),
  };
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function WhatsAppStats({ counts }: { counts: WhatsAppStatusCounts }) {
  const cards: Array<{ label: string; value: number }> = [
    { label: "Total", value: counts.total },
    { label: "Sent", value: counts.accepted + counts.sent },
    { label: "Delivered", value: counts.delivered },
    { label: "Read", value: counts.read },
    { label: "Failed", value: counts.failed },
    { label: "Queued", value: counts.queued + counts.sending },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-navy-950/10 bg-white p-4">
          <p className={labelClasses}>{c.label}</p>
          <p className="mt-1 font-display text-2xl text-navy-950">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function WhatsAppLogFiltersForm({
  filters,
  events,
}: {
  filters: WhatsAppLogFilters;
  /** Event filter options — only events this admin may see. Omit to hide the filter. */
  events?: Array<{ id: string; name: string }>;
}) {
  return (
    <form method="get" className="grid gap-3 rounded-xl border border-navy-950/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
      <label className="block">
        <span className={labelClasses}>From</span>
        <input type="date" name="from" defaultValue={filters.from ?? ""} className={inputClasses} />
      </label>
      <label className="block">
        <span className={labelClasses}>To</span>
        <input type="date" name="to" defaultValue={filters.to ?? ""} className={inputClasses} />
      </label>
      <label className="block">
        <span className={labelClasses}>Category</span>
        <select name="category" defaultValue={filters.category ?? ""} className={inputClasses}>
          <option value="">All</option>
          {Object.entries(WHATSAPP_CATEGORIES).map(([key, spec]) => (
            <option key={key} value={key}>
              {spec.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClasses}>Status</span>
        <select name="status" defaultValue={filters.status ?? ""} className={inputClasses}>
          <option value="">All</option>
          {WHATSAPP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {events ? (
        <label className="block">
          <span className={labelClasses}>Event</span>
          <select name="event" defaultValue={filters.eventId ?? ""} className={inputClasses}>
            <option value="">All</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex items-end gap-2">
        <button type="submit" className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
          Filter
        </button>
        <a href="?" className="h-10 rounded-full px-3 py-2.5 text-sm text-navy-700/70 hover:text-navy-950">
          Reset
        </a>
      </div>
    </form>
  );
}

export function WhatsAppMessageTable({ messages, showEvent }: { messages: WhatsAppMessageLog[]; showEvent: boolean }) {
  if (messages.length === 0) {
    return <p className="rounded-xl border border-dashed border-navy-950/15 p-6 text-center text-sm text-navy-700/60">No messages yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-navy-700/50">
          <tr>
            <th className="px-4 py-3 font-medium">Recipient</th>
            {showEvent ? <th className="px-4 py-3 font-medium">Event</th> : null}
            <th className="px-4 py-3 font-medium">Message</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-950/5">
          {messages.map((m) => (
            <tr key={m.id} className="align-top">
              <td className="px-4 py-3">
                <p className="text-navy-950">{m.inviteeName ?? "—"}</p>
                <p className="text-xs text-navy-700/60">{maskPhone(m.recipientPhone)}</p>
              </td>
              {showEvent ? <td className="px-4 py-3 text-navy-700/80">{m.eventName ?? "—"}</td> : null}
              <td className="px-4 py-3">
                <p className="text-navy-950">{isWhatsAppCategory(m.category) ? WHATSAPP_CATEGORIES[m.category].label : m.category}</p>
                <p className="text-xs text-navy-700/60">{m.templateName ?? m.messageType}</p>
              </td>
              <td className="px-4 py-3 text-navy-700/80">{formatWhen(m.createdAt)}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                {m.status === "queued" && m.attempts > 0 ? <p className="mt-1 text-xs text-navy-700/60">Retrying (attempt {m.attempts + 1})</p> : null}
                {m.errorTitle && (m.status === "failed" || m.status === "queued") ? (
                  <p className="mt-1 max-w-xs text-xs text-red-700">
                    {m.errorCode ? `${m.errorCode}: ` : ""}
                    {m.errorTitle}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
