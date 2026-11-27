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
  | "hr"
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
  { role: "hr", label: "HR", description: "Human resources — gets birthday reminders" },
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
  /** Calendar date YYYY-MM-DD, or "" when unknown — drives the birthday automations. */
  dateOfBirth: string;
  /** Calendar date YYYY-MM-DD, or "" when unknown — drives work-anniversary emails. */
  joiningDate: string;
  /** Unsubscribed contacts stay in the address book but are never sent to. */
  subscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MailerContactInput = Pick<
  MailerContact,
  "firstName" | "lastName" | "email" | "company" | "phone" | "eventIds" | "roles" | "subscribed"
> &
  Partial<Pick<MailerContact, "dateOfBirth" | "joiningDate">>;

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
  /**
   * A full-HTML email (CKEditor / AI, lib/mailer/html-email.ts). When set it is what
   * gets sent, and `body` is only its plain-text version. Absent/empty = the simple
   * text message in the built-in design.
   */
  html?: string;
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
  /** Show the Brand Settings logo in this campaign's header. Absent (older campaigns) = true. */
  showLogo?: boolean;
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
> &
  Partial<Pick<MailerCampaign, "showLogo" | "html">>;

/**
 * Automatic emails driven by contact dates (lib/mailer/automations.ts):
 * - birthday: to the person, on their birthday
 * - hr_birthday_reminder: to everyone with the HR role, the day before someone's birthday
 * - work_anniversary: to the person, on each anniversary of their joining date (from year 1)
 */
export type AutomationKind = "birthday" | "hr_birthday_reminder" | "work_anniversary";

export const AUTOMATION_KINDS: readonly { kind: AutomationKind; label: string; description: string }[] = [
  { kind: "birthday", label: "Birthday greeting", description: "Sent to the person on their birthday." },
  { kind: "hr_birthday_reminder", label: "HR birthday reminder", description: "Sent to everyone with the HR role the day before a birthday." },
  { kind: "work_anniversary", label: "Work anniversary", description: "Sent to the person on each anniversary of their joining date." },
];

export interface AutomationRule {
  enabled: boolean;
  content: MailerEmailContent;
}

export interface AutomationSettings {
  rules: Record<AutomationKind, AutomationRule>;
  /** Live mode: the verified Email Configuration to send from (null = the default one). */
  senderId: string | null;
  /** Shown as {{sender_name}} and as the From name. */
  senderName: string;
}

export type AutomationLogStatus = "sending" | "sent" | "failed" | "simulated";

export interface AutomationLogEntry {
  /** Unique per email, e.g. "birthday:<contactId>:2026" — a key that's already "sent" is never sent again. */
  key: string;
  kind: AutomationKind;
  /** The person whose birthday/anniversary it is. */
  contactId: string;
  contactName: string;
  /** Who the email went to (the person, or an HR contact). */
  recipientEmail: string;
  /** The day being celebrated, YYYY-MM-DD. */
  occasionDate: string;
  status: AutomationLogStatus;
  error: string | null;
  at: string;
}

export interface AutomationRunResult {
  /** The day that was processed (YYYY-MM-DD, India time). */
  date: string;
  /** What this run did — empty when nothing was due. */
  entries: AutomationLogEntry[];
}

/**
 * The company's brand (Brand Settings, lib/mailer/brand.ts), applied to
 * every email: logo in the header, primary colour on buttons and links,
 * secondary colour on headings.
 */
export interface MailerBrand {
  /**
   * PNG logo: a `data:image/png;base64,…` URL in mock mode (kept in this
   * browser only), a public Storage URL in live mode — or null for none.
   */
  logoUrl: string | null;
  /** #RRGGBB, upper-case. */
  primaryColor: string;
  /** #RRGGBB, upper-case. */
  secondaryColor: string;
  updatedAt: string;
}

export type MailerBrandInput = Pick<MailerBrand, "logoUrl" | "primaryColor" | "secondaryColor">;

/** Everything the Mailer stores, as one snapshot (the LocalStorage repository's on-disk shape). */
export interface MailerData {
  version: 1;
  events: MailerEvent[];
  contacts: MailerContact[];
  lists: MailerList[];
  templates: MailerTemplate[];
  campaigns: MailerCampaign[];
  /** Absent in data saved before automations existed — read back with defaults. */
  automations?: AutomationSettings;
  /** Newest first, capped (lib/mailer/automations.ts AUTOMATION_LOG_LIMIT). */
  automationLog?: AutomationLogEntry[];
  /** Absent until Brand Settings is first saved — emails then keep their per-kind theme. */
  brand?: MailerBrand;
}
