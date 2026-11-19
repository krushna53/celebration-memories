import type { CampaignRecipient, RecipientEvent, RecipientStatus } from "@/types/mailer";

/**
 * Simulated email provider for mock mode. Never sends anything — it only
 * decides, per recipient, what a real provider might have reported, and
 * invents a provider message id for each accepted message.
 *
 * Some outcomes are forced so demos are predictable:
 * - an address whose local part contains "bounce", or whose domain ends
 *   in ".invalid", hard-bounces;
 * - one whose local part contains "fail" is rejected by the provider.
 * Everything else is random: ~3% failed, ~5% bounced, the rest
 * delivered, and ~35% of delivered messages get a click.
 */

export interface SimulationRecipient {
  contactId: string;
  email: string;
  name: string;
}

export type Random = () => number;

export const SIMULATED_MESSAGE_ID_DOMAIN = "mock.everymoment.local";

export function mockMessageId(random: Random, now: number): string {
  const part = () => Math.floor(random() * 0xffffffff).toString(36).padStart(7, "0");
  return `<sim-${now.toString(36)}-${part()}${part()}@${SIMULATED_MESSAGE_ID_DOMAIN}>`;
}

function pickOutcome(email: string, random: Random): Exclude<RecipientStatus, "sent"> {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  if (local.includes("bounce") || domain.endsWith(".invalid")) return "bounced";
  if (local.includes("fail")) return "failed";
  const roll = random();
  if (roll < 0.03) return "failed";
  if (roll < 0.08) return "bounced";
  return random() < 0.35 ? "clicked" : "delivered";
}

export function simulateSend(
  recipients: SimulationRecipient[],
  options: { random?: Random; now?: number } = {},
): CampaignRecipient[] {
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now();
  const at = (offsetMs: number) => new Date(now + offsetMs).toISOString();

  return recipients.map((r) => {
    const outcome = pickOutcome(r.email, random);
    if (outcome === "failed") {
      return {
        ...r,
        status: "failed",
        providerMessageId: null,
        error: "Rejected by the provider (simulated).",
        events: [{ type: "failed", at: at(0) }],
      };
    }

    const sentAt = Math.floor(random() * 2000);
    const events: RecipientEvent[] = [{ type: "sent", at: at(sentAt) }];
    const settledAt = sentAt + 1000 + Math.floor(random() * 8000);
    if (outcome === "bounced") {
      events.push({ type: "bounced", at: at(settledAt) });
    } else {
      events.push({ type: "delivered", at: at(settledAt) });
      if (outcome === "clicked") events.push({ type: "clicked", at: at(settledAt + 30_000 + Math.floor(random() * 600_000)) });
    }

    return {
      ...r,
      status: outcome,
      providerMessageId: mockMessageId(random, now),
      error: outcome === "bounced" ? "Mailbox does not exist (simulated hard bounce)." : null,
      events,
    };
  });
}
