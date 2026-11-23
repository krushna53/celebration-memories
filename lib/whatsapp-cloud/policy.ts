import { WHATSAPP_CATEGORIES, type EventWhatsAppSettings, type WhatsAppCategory, type WhatsAppMessageStatus } from "./types";

/**
 * The rules for WHO may be messaged and WHEN — pure so they're tested
 * directly (tests/whatsapp-cloud.cjs) and the service layer can't drift
 * from them.
 */

export interface ConsentState {
  optedIn: boolean;
  optedOutAt: string | null;
  marketingOptedIn: boolean;
}

export interface ContactState {
  optedOutAt: string | null;
  lastInboundAt: string | null;
}

export type Decision = { ok: true } | { ok: false; reason: string };

/**
 * Event and corporate categories need an explicit opt-in on record;
 * marketing ones need the separate marketing opt-in too. A global
 * opt-out (the person replied STOP to our number) beats everything.
 * Test messages skip consent — they only ever go to the owner's own
 * verified test recipients, which the caller enforces.
 */
export function consentDecision(category: WhatsAppCategory, consent: ConsentState | null, contact: ContactState | null): Decision {
  if (contact?.optedOutAt) return { ok: false, reason: "Recipient opted out of WhatsApp messages." };
  if (category === "test") return { ok: true };
  if (!consent || !consent.optedIn) return { ok: false, reason: "No WhatsApp consent on record." };
  if (consent.optedOutAt) return { ok: false, reason: "Recipient opted out for this event." };
  if (WHATSAPP_CATEGORIES[category].marketing && !consent.marketingOptedIn) {
    return { ok: false, reason: "No marketing consent on record." };
  }
  return { ok: true };
}

const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Free-form (non-template) messages are only allowed within 24h of the person's last message to us. */
export function withinServiceWindow(lastInboundAt: string | null, now: Date): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - new Date(lastInboundAt).getTime() < CUSTOMER_SERVICE_WINDOW_MS;
}

const STATUS_RANK: Record<WhatsAppMessageStatus, number> = {
  queued: 0,
  sending: 1,
  accepted: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  failed: 6,
};

/**
 * Webhooks can arrive out of order (a "delivered" after its "read"), so
 * a status only ever moves forward. "failed" can land after "sent"
 * (delivery failed later) but never overrides "delivered"/"read".
 */
export function shouldApplyStatus(current: WhatsAppMessageStatus, incoming: "sent" | "delivered" | "read" | "failed"): boolean {
  if (current === "failed") return false;
  if (incoming === "failed") return current !== "delivered" && current !== "read";
  return STATUS_RANK[incoming] > STATUS_RANK[current];
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Which scheduled messages are due for an event right now. Each has a
 * window rather than an instant, so a cron run that's late (or missed)
 * still sends — and the idempotency key (category + invitee) makes a
 * run that's early-and-again harmless. Windows close before the next
 * message's opens, so a guest never gets a stale 24h reminder after the
 * 2h one.
 */
export function dueAutomations(settings: EventWhatsAppSettings, startAt: string, endAt: string, now: Date): WhatsAppCategory[] {
  if (!settings.enabled) return [];
  const start = new Date(startAt).getTime();
  const end = new Date(endAt || startAt).getTime();
  const t = now.getTime();
  const due: WhatsAppCategory[] = [];
  if (settings.reminder24h && t >= start - 24 * HOUR && t < start - 3 * HOUR) due.push("reminder_24h");
  if (settings.reminder2h && t >= start - 2 * HOUR && t < start) due.push("reminder_2h");
  if (settings.thankYou && t >= end + 2 * HOUR && t < end + 3 * DAY) due.push("thank_you");
  if (settings.feedbackRequest && t >= end + DAY && t < end + 4 * DAY) due.push("feedback_request");
  if (settings.memoryReminder && t >= end + 3 * DAY && t < end + 7 * DAY) due.push("memory_reminder");
  return due;
}

/** Which guests each scheduled category goes to, by RSVP status. */
export function automationAudience(category: WhatsAppCategory, rsvpStatus: string, checkedIn: boolean): boolean {
  switch (category) {
    case "reminder_24h":
    case "reminder_2h":
      return rsvpStatus === "coming" || rsvpStatus === "maybe";
    case "thank_you":
    case "feedback_request":
    case "memory_reminder":
      return checkedIn || rsvpStatus === "coming";
    default:
      return false;
  }
}

/** Opt-out / opt-in keywords in an inbound reply (case-insensitive, whole message). */
export function parseOptKeyword(text: string | null): "stop" | "start" | null {
  const word = (text ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
  if (["stop", "unsubscribe", "opt out", "optout", "cancel", "stop all"].includes(word)) return "stop";
  if (["start", "subscribe", "opt in", "optin", "unstop"].includes(word)) return "start";
  return null;
}
