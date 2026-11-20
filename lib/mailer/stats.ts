import type { CampaignRecipient } from "@/types/mailer";

export interface CampaignStats {
  recipients: number;
  /** Accepted by the provider (everything except "failed"). */
  sent: number;
  /** Reached the inbox — delivered or clicked. */
  delivered: number;
  bounced: number;
  failed: number;
  clicked: number;
  /** delivered / sent, 0–1. */
  deliveryRate: number;
  /** clicked / delivered, 0–1. */
  clickRate: number;
}

export function campaignStats(recipients: readonly CampaignRecipient[]): CampaignStats {
  let failed = 0;
  let queued = 0;
  let bounced = 0;
  let clicked = 0;
  let delivered = 0;
  for (const r of recipients) {
    if (r.status === "failed") failed += 1;
    else if (r.status === "queued") queued += 1;
    else if (r.status === "bounced") bounced += 1;
    else if (r.status === "clicked") {
      clicked += 1;
      delivered += 1;
    } else if (r.status === "delivered") delivered += 1;
  }
  // Still-queued recipients haven't been handed to the provider yet.
  const sent = recipients.length - failed - queued;
  return {
    recipients: recipients.length,
    sent,
    delivered,
    bounced,
    failed,
    clicked,
    deliveryRate: sent ? delivered / sent : 0,
    clickRate: delivered ? clicked / delivered : 0,
  };
}

export function sumStats(all: readonly CampaignStats[]): CampaignStats {
  const total = all.reduce(
    (acc, s) => ({
      recipients: acc.recipients + s.recipients,
      sent: acc.sent + s.sent,
      delivered: acc.delivered + s.delivered,
      bounced: acc.bounced + s.bounced,
      failed: acc.failed + s.failed,
      clicked: acc.clicked + s.clicked,
    }),
    { recipients: 0, sent: 0, delivered: 0, bounced: 0, failed: 0, clicked: 0 },
  );
  return {
    ...total,
    deliveryRate: total.sent ? total.delivered / total.sent : 0,
    clickRate: total.delivered ? total.clicked / total.delivered : 0,
  };
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(rate > 0 && rate < 0.1 ? 1 : 0)}%`;
}
