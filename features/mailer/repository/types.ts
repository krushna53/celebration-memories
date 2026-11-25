import type {
  AutomationRunResult,
  AutomationSettings,
  MailerCampaign,
  MailerCampaignInput,
  MailerContact,
  MailerContactInput,
  MailerData,
  MailerEvent,
  MailerList,
  MailerListInput,
  MailerBrand,
  MailerBrandInput,
  MailerSender,
  MailerTemplate,
  MailerTemplateInput,
} from "@/types/mailer";

/**
 * The only way Mailer UI reads or writes data. Components get an
 * implementation from features/mailer/mailer-provider.tsx and never touch
 * LocalStorage or Supabase themselves, so the backend can change without
 * touching the UI.
 *
 * Implementations:
 * - LocalStorageMailerRepository (mock mode, ./local-storage-repository.ts)
 * - ServerMailerRepository (live mode, ./server-repository.ts) — Firestore +
 *   real sending, through Server Actions
 * - SupabaseMailerRepository (./supabase-repository.ts) — placeholder until
 *   the database tables and Server Actions exist.
 *
 * Every method is async even though LocalStorage isn't, so a Supabase
 * (Server Action) implementation fits the same shape.
 *
 * Errors meant for the person using the page are thrown as MailerError;
 * anything else is a bug.
 */
export interface MailerRepository {
  /** Everything in one go — the Mailer screens all work off one snapshot. */
  load(): Promise<MailerData>;

  listEvents(): Promise<MailerEvent[]>;

  /** Throws MailerError when the email is invalid or another contact already uses it. */
  saveContact(input: MailerContactInput, id?: string): Promise<MailerContact>;
  deleteContact(id: string): Promise<void>;
  /** Adds already-validated, de-duplicated contacts (lib/mailer/csv-import.ts), optionally to a list. */
  importContacts(inputs: MailerContactInput[], listId?: string | null): Promise<MailerContact[]>;

  saveList(input: MailerListInput, id?: string): Promise<MailerList>;
  deleteList(id: string): Promise<void>;

  saveTemplate(input: MailerTemplateInput, id?: string): Promise<MailerTemplate>;
  /** Built-in templates can't be deleted. */
  deleteTemplate(id: string): Promise<void>;

  /** Only drafts can be edited. */
  saveCampaign(input: MailerCampaignInput, id?: string): Promise<MailerCampaign>;
  deleteCampaign(id: string): Promise<void>;
  /**
   * Sends a draft campaign to its resolved audience. The mock
   * implementation only simulates this (lib/mailer/simulate.ts); live mode
   * sends through `senderId` (a verified Email Configuration, or the
   * default one when omitted).
   */
  sendCampaign(id: string, options?: { senderId?: string | null }): Promise<MailerCampaign>;
  /** Verified Email Configurations a live campaign can be sent from (always empty in mock mode). */
  listSenders(): Promise<MailerSender[]>;

  /** Birthday / work-anniversary automations: which are on, their email content, and the sender. */
  saveAutomationSettings(settings: AutomationSettings): Promise<AutomationSettings>;
  /**
   * Sends whatever is due today (or on `date`, for testing). Mock mode only
   * logs it as simulated; live mode sends for real. Already-sent emails are
   * never sent twice. A daily job does this automatically in live mode.
   */
  runAutomations(options?: { date?: string | null }): Promise<AutomationRunResult>;

  /** Brand Settings (lib/mailer/brand.ts): logo + colours applied to every email. */
  saveBrandSettings(input: MailerBrandInput): Promise<MailerBrand>;
  /**
   * Stores a logo PNG (already converted in the browser) and returns the URL
   * to save with saveBrandSettings: an inline data URL in mock mode, a
   * public Storage URL in live mode. Browser-only.
   */
  uploadLogo(png: Blob): Promise<string>;

  /** Mock mode only: wipe everything and restore the demo data (brand included). */
  resetDemoData(): Promise<void>;
}

export class MailerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailerError";
  }
}
