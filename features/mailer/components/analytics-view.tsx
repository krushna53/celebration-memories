"use client";

import { CheckCircle2, MailX, MousePointerClick, Send } from "lucide-react";

import { campaignStats, formatPercent, sumStats } from "@/lib/mailer/stats";
import { useMailer } from "@/features/mailer/mailer-provider";
import { useMailerNav } from "@/features/mailer/mailer-nav";
import { Card, EmptyState, KindTag, SimulatedBadge, StatCard } from "@/features/mailer/components/ui";

function RateBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-navy-950/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-11 text-right tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}

/** Totals across every sent campaign, then a per-campaign comparison. */
export function AnalyticsView() {
  const { data } = useMailer();
  const navigate = useMailerNav();
  const sent = data.campaigns
    .filter((c) => c.status === "sent")
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  const rows = sent.map((c) => ({ campaign: c, stats: campaignStats(c.recipients) }));
  const totals = sumStats(rows.map((r) => r.stats));

  if (sent.length === 0) {
    return <EmptyState title="No sent campaigns yet">Send (or simulate) a campaign to see delivery and click statistics here.</EmptyState>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Send} label="Emails Sent" value={totals.sent.toLocaleString("en-IN")} note={`${sent.length} campaign${sent.length === 1 ? "" : "s"}`} />
        <StatCard icon={CheckCircle2} label="Delivered" value={totals.delivered.toLocaleString("en-IN")} note={formatPercent(totals.deliveryRate)} tone="good" />
        <StatCard icon={MousePointerClick} label="Clicks" value={totals.clicked.toLocaleString("en-IN")} note={formatPercent(totals.clickRate)} tone="good" />
        <StatCard
          icon={MailX}
          label="Bounced + Failed"
          value={(totals.bounced + totals.failed).toLocaleString("en-IN")}
          note={totals.recipients ? formatPercent((totals.bounced + totals.failed) / totals.recipients) : undefined}
          tone={totals.bounced + totals.failed ? "bad" : "neutral"}
        />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-xl text-navy-950">Campaign performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-navy-700/60">
              <tr className="border-b border-navy-950/10">
                <th className="py-2 pr-3 font-medium">Campaign</th>
                <th className="py-2 pr-3 text-right font-medium">Sent</th>
                <th className="py-2 pr-3 text-right font-medium">Delivered</th>
                <th className="py-2 pr-3 text-right font-medium">Bounced</th>
                <th className="py-2 pr-3 text-right font-medium">Failed</th>
                <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                <th className="py-2 pr-3 font-medium">Delivery rate</th>
                <th className="py-2 font-medium">Click rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ campaign, stats }) => (
                <tr key={campaign.id} className="border-b border-navy-950/5 last:border-0">
                  <td className="py-3 pr-3">
                    <button type="button" onClick={() => navigate({ name: "campaign", id: campaign.id })} className="text-left font-medium text-navy-950 hover:text-gold-600">
                      {campaign.name}
                    </button>
                    <div className="mt-1 flex items-center gap-1.5">
                      <KindTag kind={campaign.kind} />
                      {campaign.simulated ? <SimulatedBadge /> : null}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">{stats.sent}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{stats.delivered}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{stats.bounced}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{stats.failed}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{stats.clicked}</td>
                  <td className="py-3 pr-3">
                    <RateBar value={stats.deliveryRate} color="bg-emerald-500" />
                  </td>
                  <td className="py-3">
                    <RateBar value={stats.clickRate} color="bg-violet-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-navy-700/55">
          Delivery rate = delivered ÷ accepted by the provider. Click rate = clicked ÷ delivered.
        </p>
      </Card>
    </div>
  );
}
