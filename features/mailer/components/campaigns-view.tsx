"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileEdit, Mail, MousePointerClick } from "lucide-react";

import { CAMPAIGN_KINDS, type CampaignKind, type MailerCampaign } from "@/types/mailer";
import { resolveAudience } from "@/lib/mailer/audience";
import { campaignStats, formatPercent, sumStats } from "@/lib/mailer/stats";
import { useMailer } from "@/features/mailer/mailer-provider";
import { useMailerNav } from "@/features/mailer/mailer-nav";
import { CampaignCard } from "@/features/mailer/components/campaign-card";
import { Card, EmptyState, inputClasses, SearchInput, StatCard } from "@/features/mailer/components/ui";

function useRecipientCounts(): Map<string, number> {
  const { data } = useMailer();
  return useMemo(
    () =>
      new Map(
        data.campaigns.map((c) => [
          c.id,
          c.status === "sent" ? c.recipients.length : resolveAudience(c.audience, data.contacts, data.lists).recipients.length,
        ]),
      ),
    [data],
  );
}

function newestFirst(a: MailerCampaign, b: MailerCampaign) {
  return (b.sentAt ?? b.updatedAt).localeCompare(a.sentAt ?? a.updatedAt);
}

/** Dashboard: headline numbers + the most recent campaigns. */
export function DashboardView() {
  const { data } = useMailer();
  const navigate = useMailerNav();
  const counts = useRecipientCounts();
  const sent = data.campaigns.filter((c) => c.status === "sent");
  const totals = sumStats(sent.map((c) => campaignStats(c.recipients)));
  const recent = [...data.campaigns].sort(newestFirst).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Mail} label="Total Campaigns" value={data.campaigns.length} />
        <StatCard icon={CheckCircle2} label="Sent" value={sent.length} note={`${totals.sent} emails`} />
        <StatCard icon={FileEdit} label="Drafts" value={data.campaigns.length - sent.length} />
        <StatCard
          icon={MousePointerClick}
          label="Avg. Click Rate"
          value={formatPercent(totals.clickRate)}
          note={`${formatPercent(totals.deliveryRate)} delivered`}
        />
      </div>

      <Card className="bg-navy-950/[0.015]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-navy-950">Recent Campaigns</h2>
          <button type="button" onClick={() => navigate({ name: "campaigns" })} className="text-sm font-medium text-gold-600 hover:text-gold-500">
            View all
          </button>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No campaigns yet">Create your first one with &ldquo;New Campaign&rdquo;.</EmptyState>
        ) : (
          <div className="space-y-3">
            {recent.map((c) => (
              <CampaignCard key={c.id} campaign={c} recipientCount={counts.get(c.id) ?? 0} />
            ))}
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-3 font-display text-xl text-navy-950">Start a campaign</h2>
        <NewCampaignTiles />
      </div>
    </div>
  );
}

export function NewCampaignTiles({ onPick }: { onPick?: () => void }) {
  const navigate = useMailerNav();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {CAMPAIGN_KINDS.map((k) => (
        <button
          key={k.kind}
          type="button"
          onClick={() => {
            onPick?.();
            navigate({ name: "editor", kind: k.kind });
          }}
          className="rounded-2xl border border-navy-950/[0.07] bg-white p-4 text-left shadow-[0_1px_2px_rgba(30,27,75,0.04)] transition hover:border-gold-500/50 hover:shadow-md"
        >
          <p className="font-medium text-navy-950">{k.label}</p>
          <p className="mt-1 text-sm text-navy-700/65">{k.description}</p>
        </button>
      ))}
    </div>
  );
}

/** Every campaign, searchable and filterable. */
export function CampaignsView() {
  const { data } = useMailer();
  const counts = useRecipientCounts();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "sent">("all");
  const [kind, setKind] = useState<"all" | CampaignKind>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data.campaigns]
      .filter((c) => status === "all" || c.status === status)
      .filter((c) => kind === "all" || c.kind === kind)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q))
      .sort(newestFirst);
  }, [data.campaigns, query, status, kind]);

  return (
    <Card className="bg-navy-950/[0.015]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <h2 className="font-display text-xl text-navy-950 sm:flex-1">All Campaigns</h2>
        <SearchInput value={query} onChange={setQuery} placeholder="Search campaigns..." className="sm:w-56" />
        <div className="flex gap-2">
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClasses}>
            <option value="all">All Status</option>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
          </select>
          <select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClasses}>
            <option value="all">All Types</option>
            {CAMPAIGN_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="No campaigns match">Try a different search or filter.</EmptyState>
      ) : (
        <div className="space-y-3">
          {shown.map((c) => (
            <CampaignCard key={c.id} campaign={c} recipientCount={counts.get(c.id) ?? 0} />
          ))}
        </div>
      )}
    </Card>
  );
}
