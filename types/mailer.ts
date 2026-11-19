/**
 * Corporate Event Mailer — shared types (features/mailer/, lib/mailer/).
 *
 * The Mailer is isolated from the rest of the app: its "events" are
 * MailerEvent records (demo events in mock mode), not rows from the real
 * `events` table, and none of these types are stored in Supabase yet.
 * See features/mailer/repository/ for where they are persisted.
 */

export interface MailerEvent {
  id: string;
  name: string;
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  venue: string;
}

export type ContactRole =
  | "admin"
  | "manager"
  | "employee"
  | "customer"
  | "client"
  | "member"
  | "vendor"
  | "partner"
  | "guest"
  | "subscriber";

/** A contact can have any number of roles (e.g. Employee + Subscriber). This order is the display order. */
export const CONTACT_ROLES: readonly { role: ContactRole; label: string; description: string }[] = [
  { role: "admin", label: "Admin", description: "Manages the system" },
  { role: "manager", label: "Manager", description: "Manages a team" },
  { role: "employee", label: "Employee", description: "Company employee" },
  { role: "customer", label: "Customer", description: "Customer" },
  { role: "client", label: "Client", description: "Business client" },
  { role: "member", label: "Member", description: "Group member" },
  { role: "vendor", label: "Vendor", description: "Service provider" },
  { role: "partner", label: "Partner", description: "Business partner" },
  { role: "guest", label: "Guest", description: "Temporary user" },
  { role: "subscriber", label: "Subscriber", description: "Receives email updates" },
];

/** Keeps only known roles, de-duplicated, in CONTACT_ROLES order. Accepts labels or keys, any case. */
export function normalizeRoles(values: readonly string[] | undefined): ContactRole[] {
  const wanted = new Set((values ?? []).map((v) => v.trim().toLowerCase()));
  return CONTACT_ROLES.filter((r) => wanted.has(r.role)).map((r) => r.role);
}

export interface MailerContact {
  id: string;
  firstName: string;
  lastName: string;
  /** Stored lower-cased and trimmed (lib/mailer/email.ts normalizeEmail). */
  email: string;
  company: string;
  phone: string;
  eventIds: string[];
  /** Zero or more roles (CONTACT_ROLES). Contacts saved before roles existed are read back with []. */
  roles: ContactRole[];
  /** Unsubscribed contacts stay in the address book but are never sent to. */
  subscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MailerContactInput = Pick<
  MailerContact,
  "firstName" | "lastName" | "email" | "company" | "phone" | "eventIds" | "roles" | "subscribed"
>;

export interface MailerList {
  id: string;
  name: string;
  description: string;
  contactIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type MailerListInput = Pick<MailerList, "name" | "description" | "contactIds">;

export type CampaignKind = "diwali" | "new_year" | "invitation" | "announcement";

export const CAMPAIGN_KINDS: readonly { kind: CampaignKind; label: string; description: string }[] = [
  { kind: "diwali", label: "Diwali Greeting", description: "Festive wishes for clients, partners and teams." },
  { kind: "new_year", label: "New Year Greeting", description: "Close the year with a warm thank-you." },
  { kind: "invitation", label: "Event Invitation", description: "Invite people to one of your events." },
  { kind: "announcement", label: "Announcement", description: "Share news, updates or reminders." },
];

/** The email content shared by a template and a campaign. Body is plain text: blank lines split paragraphs. */
export interface MailerEmailContent {
  subject: string;
  preheader: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

export interface MailerTemplate extends MailerEmailContent {
  id: string;
  name: string;
  kind: CampaignKind;
  /** Seeded with the demo data — can be edited but not deleted. */
  builtIn: boolean;
  updatedAt: string;
}

export type MailerTemplateInput = Pick<MailerTemplate, "name" | "kind"> & MailerEmailContent;

/** "queued" = picked for a live send that hasn't reached this person yet. */
export type RecipientStatus = "queued" | "sent" | "delivered" | "bounced" | "clicked" | "failed";

export interface RecipientEvent {
  type: RecipientStatus;
  at: string;
}

export interface CampaignRecipient {
  contactId: string;
  email: string;
  name: string;
  /** The furthest status reached: clicked > delivered > sent; bounced/failed are terminal. */
  status: RecipientStatus;
  /** Null when the provider rejected the message outright (status "failed"). */
  providerMessageId: string | null;
  error: string | null;
  events: RecipientEvent[];
}

export interface CampaignAudience {
  contactIds: string[];
  listIds: string[];
}

export interface MailerCampaign extends MailerEmailContent {
  id: string;
  name: string;
  kind: CampaignKind;
  templateId: string | null;
  senderName: string;
  /** The event used for {{event_*}} tokens; required for invitations. */
  eventId: string | null;
  audience: CampaignAudience;
  status: "draft" | "sent";
  /** True when "sending" was simulated (mock mode) — no real email left the app. */
  simulated: boolean;
  /** Live sends only: the Email Configuration it went out through, and whether it's still going. */
  delivery?: CampaignDelivery | null;
  recipients: CampaignRecipient[];
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
}

export interface CampaignDelivery {
  state: "sending" | "done";
  senderId: string;
  senderLabel: string;
  fromName: string;
  fromEmail: string;
  startedAt: string;
  finishedAt: string | null;
}

/** A verified Email Configuration a live campaign can be sent from (no SMTP details — those never leave the server). */
export interface MailerSender {
  id: string;
  label: string;
  senderName: string;
  fromEmail: string;
  isDefault: boolean;
}

export type MailerCampaignInput = Pick<
  MailerCampaign,
  | "name"
  | "kind"
  | "templateId"
  | "senderName"
  | "eventId"
  | "audience"
  | "subject"
  | "preheader"
  | "body"
  | "ctaLabel"
  | "ctaUrl"
>;

/** Everything the Mailer stores, as one snapshot (the LocalStorage repository's on-disk shape). */
export interface MailerData {
  version: 1;
  events: MailerEvent[];
  contacts: MailerContact[];
  lists: MailerList[];
  templates: MailerTemplate[];
  campaigns: MailerCampaign[];
}
