"use client";

import { Eye, Mail, Pencil } from "lucide-react";

import type { MailerCampaign } from "@/types/mailer";
import { campaignStats, formatPercent } from "@/lib/mailer/stats";
import { renderTokens, sampleTokenValues } from "@/lib/mailer/tokens";
import { useMailerNav } from "@/features/mailer/mailer-nav";
import { CampaignStatusPill, KIND_ICON_BG, KindTag, Metric, SimulatedBadge, timeAgo } from "@/features/mailer/components/ui";
import { cn } from "@/lib/utils";

/** A campaign in the Dashboard / Campaigns lists: title row, tags, and a metrics row once it's sent. */
export function CampaignCard({ campaign, recipientCount }: { campaign: MailerCampaign; recipientCount: number }) {
  const navigate = useMailerNav();
  const sent = campaign.status === "sent";
  const stats = campaignStats(campaign.recipients);
  const open = () => navigate(sent ? { name: "campaign", id: campaign.id } : { name: "editor", id: campaign.id });

  return (
    <div className="rounded-2xl border border-navy-950/[0.07] bg-white p-4 shadow-[0_1px_2px_rgba(30,27,75,0.04)]">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", KIND_ICON_BG[campaign.kind])}>
          <Mail size={17} aria-hidden="true" />
        </span>
        <button type="button" onClick={open} className="min-w-0 flex-1 basis-[calc(100%-3rem)] text-left sm:basis-0">
          <p className="truncate font-medium text-navy-950 hover:text-gold-600">{campaign.name}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-x-1.5 text-xs text-navy-700/60">
            {/* Tokens shown with sample values, so a draft's subject reads naturally ("Hi Priya" not "Hi {{first_name}}"). */}
            <span className="min-w-0 truncate">{campaign.subject ? renderTokens(campaign.subject, sampleTokenValues()) : "No subject yet"}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{sent && campaign.sentAt ? `Sent ${timeAgo(campaign.sentAt)}` : `Edited ${timeAgo(campaign.updatedAt)}`}</span>
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1.5 pl-12 sm:pl-0">
          <button
            type="button"
            onClick={open}
            aria-label={sent ? `View ${campaign.name}` : `Edit ${campaign.name}`}
            className="rounded-lg p-1.5 text-navy-700/55 hover:bg-navy-950/5 hover:text-navy-950"
          >
            {sent ? <Eye size={16} /> : <Pencil size={16} />}
          </button>
          {sent && campaign.simulated ? <SimulatedBadge /> : null}
          <CampaignStatusPill status={campaign.status} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex flex-wrap gap-1.5 lg:w-40 lg:shrink-0">
          <KindTag kind={campaign.kind} />
        </div>
        {sent ? (
          <div className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-5">
            <Metric label="Sent" value={stats.sent.toLocaleString("en-IN")} />
            <Metric label="Delivered" value={stats.delivered.toLocaleString("en-IN")} />
            <Metric label="Clicks" value={stats.clicked.toLocaleString("en-IN")} />
            <Metric label="Delivery Rate" value={formatPercent(stats.deliveryRate)} />
            <Metric label="Click Rate" value={formatPercent(stats.clickRate)} />
          </div>
        ) : (
          <p className="flex-1 rounded-xl bg-navy-950/[0.035] px-3 py-2.5 text-sm text-navy-700/70">
            Draft · would go to <span className="font-semibold text-navy-950">{recipientCount}</span> subscribed contact
            {recipientCount === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}
