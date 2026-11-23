/**
 * Shared types + the notification-category registry for the WhatsApp
 * Cloud API integration (docs/WHATSAPP_INTEGRATION.md). Deliberately
 * dependency-free (type-only imports at most) so the pure helpers in this
 * folder can be unit-tested straight from tests/whatsapp-cloud.cjs.
 */

/** Event workflows (guests of one event) vs. corporate workflows (employees of one company — designed for, not built yet). */
export type WhatsAppScope = "event" | "corporate" | "platform";

export interface WhatsAppCategorySpec {
  label: string;
  scope: WhatsAppScope;
  /** Template name to use when the owner hasn't mapped one in /admin/whatsapp. */
  defaultTemplate: string;
  defaultLanguage: string;
  /** Named body parameters, in {{1}}, {{2}}… order. */
  params: readonly string[];
  /** Meta template category to request when submitting the template for approval. */
  metaCategory: "UTILITY" | "MARKETING";
  /** Needs the separate marketing consent (whatsapp_consents.marketing_opted_in), not just event-notification consent. */
  marketing: boolean;
  /** Suggested body text for the template submission (docs + the admin page). */
  sampleBody: string;
}

export const WHATSAPP_CATEGORIES = {
  invitation: {
    label: "Invitation",
    scope: "event",
    defaultTemplate: "em_event_invitation",
    defaultLanguage: "en",
    params: ["guest_name", "host_name", "event_name", "event_when", "venue", "link"],
    metaCategory: "MARKETING",
    marketing: false,
    sampleBody:
      "Hello {{1}}, {{2}} warmly invites you to {{3}} on {{4}} at {{5}}. Please RSVP using your personal invitation: {{6}} — we hope to see you there!",
  },
  rsvp_confirmation: {
    label: "RSVP confirmation",
    scope: "event",
    defaultTemplate: "em_rsvp_confirmation",
    defaultLanguage: "en",
    params: ["guest_name", "event_name", "attendance", "event_when", "venue", "link"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody:
      "Hi {{1}}, thank you for your RSVP to {{2}}. Your response: {{3}}. When: {{4}}. Where: {{5}}. You can update your RSVP any time here: {{6}} — see you soon.",
  },
  reminder_24h: {
    label: "Reminder (24 hours before)",
    scope: "event",
    defaultTemplate: "em_event_reminder",
    defaultLanguage: "en",
    params: ["guest_name", "event_name", "event_when", "venue", "link"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "Hi {{1}}, a reminder that {{2}} is on {{3}} at {{4}}. Event details and directions: {{5}} — see you there.",
  },
  reminder_2h: {
    label: "Reminder (2 hours before)",
    scope: "event",
    defaultTemplate: "em_event_reminder",
    defaultLanguage: "en",
    params: ["guest_name", "event_name", "event_when", "venue", "link"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "Hi {{1}}, a reminder that {{2}} is on {{3}} at {{4}}. Event details and directions: {{5}} — see you there.",
  },
  thank_you: {
    label: "Thank you + photo sharing",
    scope: "event",
    defaultTemplate: "em_event_thank_you",
    defaultLanguage: "en",
    params: ["guest_name", "event_name", "host_name", "link"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody:
      "Hi {{1}}, thank you for celebrating {{2}} with us. If you took photos or videos, please add them here: {{4}} — with love, {{3}}.",
  },
  memory_reminder: {
    label: "Photo/video reminder",
    scope: "event",
    defaultTemplate: "em_memory_reminder",
    defaultLanguage: "en",
    params: ["guest_name", "event_name", "link"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "Hi {{1}}, we're collecting photos and videos from {{2}}. You can upload yours from your phone here: {{3}} — thank you!",
  },
  feedback_request: {
    label: "Feedback request",
    scope: "event",
    defaultTemplate: "em_event_feedback",
    defaultLanguage: "en",
    params: ["guest_name", "event_name", "link"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "Hi {{1}}, thank you for attending {{2}}. We'd love to hear your thoughts — leave a message here: {{3}} — thank you.",
  },
  test: {
    label: "Test message",
    scope: "platform",
    defaultTemplate: "hello_world",
    defaultLanguage: "en_US",
    params: [],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "(Meta's pre-approved hello_world sample template)",
  },
  // Corporate (Phase 7) — registry entries only; no workflow sends these yet.
  corporate_birthday: {
    label: "Employee birthday",
    scope: "corporate",
    defaultTemplate: "em_corporate_birthday",
    defaultLanguage: "en",
    params: ["employee_name", "company_name"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "Happy birthday, {{1}}! Warm wishes from all of us at {{2}} — have a wonderful day.",
  },
  corporate_work_anniversary: {
    label: "Work anniversary",
    scope: "corporate",
    defaultTemplate: "em_corporate_anniversary",
    defaultLanguage: "en",
    params: ["employee_name", "years", "company_name"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "Congratulations {{1}} on {{2}} years with {{3}}! Thank you for everything you do.",
  },
  corporate_festival: {
    label: "Festival greeting",
    scope: "corporate",
    defaultTemplate: "em_corporate_festival",
    defaultLanguage: "en",
    params: ["employee_name", "festival", "company_name"],
    metaCategory: "MARKETING",
    marketing: true,
    sampleBody: "Dear {{1}}, wishing you and your family a very happy {{2}} — from everyone at {{3}}.",
  },
  corporate_announcement: {
    label: "Company announcement",
    scope: "corporate",
    defaultTemplate: "em_corporate_announcement",
    defaultLanguage: "en",
    params: ["employee_name", "company_name", "announcement"],
    metaCategory: "UTILITY",
    marketing: false,
    sampleBody: "Hi {{1}}, an update from {{2}}: {{3}} — thank you.",
  },
} as const satisfies Record<string, WhatsAppCategorySpec>;

export type WhatsAppCategory = keyof typeof WHATSAPP_CATEGORIES;

export const EVENT_CATEGORIES = (Object.keys(WHATSAPP_CATEGORIES) as WhatsAppCategory[]).filter(
  (c) => WHATSAPP_CATEGORIES[c].scope === "event",
);

export function isWhatsAppCategory(value: string): value is WhatsAppCategory {
  return Object.prototype.hasOwnProperty.call(WHATSAPP_CATEGORIES, value);
}

/** queued → sending → accepted (Graph API took it) → sent → delivered → read; failed is terminal. */
export const WHATSAPP_STATUSES = ["queued", "sending", "accepted", "sent", "delivered", "read", "failed"] as const;
export type WhatsAppMessageStatus = (typeof WHATSAPP_STATUSES)[number];

export type WhatsAppMessageType = "template" | "text" | "image" | "document";

/** The /messages request body minus messaging_product/to — what whatsapp_messages.payload stores. */
export type WhatsAppOutgoingPayload =
  | {
      type: "template";
      template: {
        name: string;
        language: { code: string };
        components?: Array<{ type: "body"; parameters: Array<{ type: "text"; text: string }> }>;
      };
    }
  | { type: "text"; text: { body: string; preview_url: boolean } }
  | { type: "image"; image: { link: string; caption?: string } }
  | { type: "document"; document: { link: string; caption?: string; filename?: string } };

/** Owner-mapped template per category (whatsapp_settings.templates). */
export type WhatsAppTemplateMap = Partial<Record<WhatsAppCategory, { name: string; language: string }>>;

export interface WhatsAppPlatformSettings {
  enabled: boolean;
  templates: WhatsAppTemplateMap;
  testRecipients: string[];
  updatedAt: string | null;
}

export interface EventWhatsAppSettings {
  eventId: string;
  enabled: boolean;
  rsvpConfirmation: boolean;
  reminder24h: boolean;
  reminder2h: boolean;
  thankYou: boolean;
  memoryReminder: boolean;
  feedbackRequest: boolean;
}

export interface WhatsAppMessageLog {
  id: string;
  eventId: string | null;
  eventName: string | null;
  inviteeName: string | null;
  recipientPhone: string;
  messageType: WhatsAppMessageType;
  templateName: string | null;
  category: string;
  status: WhatsAppMessageStatus;
  attempts: number;
  errorCode: number | null;
  errorTitle: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
}

export type WhatsAppStatusCounts = Record<WhatsAppMessageStatus, number> & { total: number };

export interface WhatsAppLogFilters {
  from?: string | null;
  to?: string | null;
  category?: string | null;
  status?: WhatsAppMessageStatus | null;
  eventId?: string | null;
}

/** Normalised webhook notification (lib/whatsapp-cloud/webhook.ts parseWebhookPayload). */
export type WhatsAppWebhookEvent =
  | {
      kind: "status";
      dedupeKey: string;
      wamid: string;
      status: "sent" | "delivered" | "read" | "failed";
      recipientPhone: string;
      timestamp: string;
      errors: Array<{ code: number; title: string }>;
      raw: unknown;
    }
  | {
      kind: "message";
      dedupeKey: string;
      wamid: string;
      fromPhone: string;
      timestamp: string;
      messageType: string;
      text: string | null;
      raw: unknown;
    }
  | {
      kind: "error";
      dedupeKey: string;
      errors: Array<{ code: number; title: string }>;
      raw: unknown;
    };
