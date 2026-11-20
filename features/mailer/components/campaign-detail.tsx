"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, MailX, MousePointerClick, Send, Trash2, XCircle } from "lucide-react";

import type { RecipientStatus } from "@/types/mailer";
import { campaignStats, formatPercent } from "@/lib/mailer/stats";
import { useMailer } from "@/features/mailer/mailer-provider";
import { useMailerNav } from "@/features/mailer/mailer-nav";
import { EmailPreview } from "@/features/mailer/components/email-preview";
import {
  Card,
  dangerButton,
  ErrorText,
  formatDateTime,
  inputClasses,
  KindTag,
  SearchInput,
  secondaryButton,
  SimulatedBadge,
  StatCard,
  STATUS_STYLES,
  StatusBadge,
} from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

const STATUS_ORDER: RecipientStatus[] = ["clicked", "delivered", "sent", "queued", "bounced", "failed"];
const BAR_COLORS: Record<RecipientStatus, string> = {
  queued: "bg-navy-950/20",
  clicked: "bg-violet-500",
  delivered: "bg-emerald-500",
  sent: "bg-sky-400",
  bounced: "bg-orange-400",
  failed: "bg-red-500",
};

/** A sent campaign: headline stats, status breakdown bar, per-recipient table, and the email as sent. */
export function CampaignDetail({ id }: { id: string }) {
  const { data, run } = useMailer();
  const navigate = useMailerNav();
  const campaign = data.campaigns.find((c) => c.id === id);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | RecipientStatus>("all");
  const [tab, setTab] = useState<"recipients" | "email">("recipients");
  const [error, setError] = useState<string | null>(null);

  const recipients = useMemo(() => {
    if (!campaign) return [];
    const q = query.trim().toLowerCase();
    return campaign.recipients
      .filter((r) => status === "all" || r.status === status)
      .filter((r) => !q || r.email.includes(q) || r.name.toLowerCase().includes(q));
  }, [campaign, query, status]);

  if (!campaign) {
    return (
      <div className="space-y-3">
        <ErrorText>That campaign no longer exists.</ErrorText>
        <button type="button" onClick={() => navigate({ name: "campaigns" })} className={secondaryButton}>
          <ArrowLeft size={16} /> Campaigns
        </button>
      </div>
    );
  }

  const stats = campaignStats(campaign.recipients);
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, campaign.recipients.filter((r) => r.status === s).length])) as Record<
    RecipientStatus,
    number
  >;
  const event = data.events.find((e) => e.id === campaign.eventId) ?? null;
  const recipientContacts = campaign.recipients
    .map((r) => data.contacts.find((c) => c.id === r.contactId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  async function duplicate() {
    if (!campaign) return;
    const { name, kind, templateId, senderName, eventId, audience, subject, preheader, body, ctaLabel, ctaUrl } = campaign;
    const result = await run((repo) =>
      repo.saveCampaign({ name: `${name} (copy)`, kind, templateId, senderName, eventId, audience, subject, preheader, body, ctaLabel, ctaUrl }),
    );
    if (result.ok) navigate({ name: "editor", id: result.value.id });
    else setError(result.error);
  }

  async function remove() {
    if (!campaign || !confirm(`Delete "${campaign.name}" and its results?`)) return;
    const result = await run((repo) => repo.deleteCampaign(campaign.id));
    if (result.ok) navigate({ name: "campaigns" });
    else setError(result.error);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => navigate({ name: "campaigns" })} className={secondaryButton}>
          <ArrowLeft size={16} /> Campaigns
        </button>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-xl text-navy-950">
            {campaign.name} {campaign.simulated ? <SimulatedBadge /> : null}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-navy-700/60">
            <KindTag kind={campaign.kind} />
            {campaign.sentAt ? <span>Sent {formatDateTime(campaign.sentAt)}</span> : null}
            {event ? <span>· {event.name}</span> : null}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={duplicate} className={secondaryButton}>
            <Copy size={15} /> Duplicate
          </button>
          <button type="button" onClick={remove} className={dangerButton}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      {campaign.simulated ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This campaign was <strong>simulated</strong> — no email was actually sent. Message IDs, delivery, bounces and clicks below
          are generated for testing.
        </p>
      ) : null}
      {!campaign.simulated && campaign.delivery ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Sent for real from{" "}
          <strong>
            {campaign.delivery.fromName} &lt;{campaign.delivery.fromEmail}&gt;
          </strong>{" "}
          (Email Settings: {campaign.delivery.senderLabel}).{" "}
          {campaign.delivery.state === "sending" ? <strong>Still sending — {counts.queued} left in the queue. </strong> : null}
          &ldquo;Sent&rdquo; means your email server accepted the message. Delivery, bounces and clicks aren&rsquo;t tracked yet — check failed
          rows for the reason.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Send} label="Sent" value={stats.sent} note={`of ${stats.recipients}`} />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} note={formatPercent(stats.deliveryRate)} tone="good" />
        <StatCard icon={MousePointerClick} label="Clicked" value={stats.clicked} note={formatPercent(stats.clickRate)} tone="good" />
        <StatCard icon={MailX} label="Bounced" value={stats.bounced} tone={stats.bounced ? "bad" : "neutral"} note={stats.sent ? formatPercent(stats.bounced / stats.sent) : undefined} />
        <StatCard icon={XCircle} label="Failed" value={stats.failed} tone={stats.failed ? "bad" : "neutral"} />
      </div>

      <Card>
        <p className="text-sm font-medium text-navy-950">Recipient status</p>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-navy-950/5" role="img" aria-label={STATUS_ORDER.map((s) => `${counts[s]} ${s}`).join(", ")}>
          {STATUS_ORDER.map((s) =>
            counts[s] ? (
              <div key={s} className={cn(BAR_COLORS[s], "h-full border-r border-white last:border-r-0")} style={{ width: `${(counts[s] / stats.recipients) * 100}%` }} />
            ) : null,
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(status === s ? "all" : s);
                setTab("recipients");
              }}
              aria-pressed={status === s}
              className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset", STATUS_STYLES[s], status === s ? "ring-navy-950/40" : "ring-transparent")}
            >
              {s} · {counts[s]}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["recipients", "email"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn("rounded-xl px-3 py-1.5 text-sm font-medium", tab === t ? "bg-navy-950 text-white" : "text-navy-700/70 hover:bg-navy-950/5")}
            >
              {t === "recipients" ? `Recipients (${campaign.recipients.length})` : "Email as sent"}
            </button>
          ))}
          {tab === "recipients" ? (
            <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
              <SearchInput value={query} onChange={setQuery} placeholder="Search recipients..." className="sm:w-56" />
              <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={cn(inputClasses, "w-auto")}>
                <option value="all">All</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {tab === "email" ? (
          <EmailPreview kind={campaign.kind} content={campaign} senderName={campaign.senderName} event={event} contacts={recipientContacts} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-navy-700/60">
                <tr className="border-b border-navy-950/10">
                  <th className="py-2 pr-3 font-medium">Recipient</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Last update</th>
                  <th className="py-2 font-medium">Provider message ID</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const last = r.events.at(-1);
                  return (
                    <tr key={r.contactId} className="border-b border-navy-950/5 align-top last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="text-navy-950">{r.name}</p>
                        <p className="text-xs text-navy-700/60">{r.email}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={r.status} />
                        {r.error ? <p className="mt-1 max-w-[24ch] text-xs text-red-700">{r.error}</p> : null}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-navy-700/70">{last ? formatDateTime(last.at) : "—"}</td>
                      <td className="py-2.5 font-mono text-[11px] text-navy-700/70 [overflow-wrap:anywhere]">{r.providerMessageId ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {recipients.length === 0 ? <p className="py-6 text-center text-sm text-navy-700/60">No recipients match.</p> : null}
          </div>
        )}
      </Card>
    </div>
  );
}
