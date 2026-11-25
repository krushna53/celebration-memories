import type {
  MailerBrand,
  MailerBrandInput,
  MailerCampaign,
  MailerCampaignInput,
  MailerContact,
  MailerContactInput,
  MailerData,
  MailerList,
  MailerListInput,
  MailerTemplate,
  MailerTemplateInput,
} from "@/types/mailer";
import { AUTOMATION_KINDS, normalizeRoles, type AutomationRunResult, type AutomationSettings } from "@/types/mailer";
import {
  automationSettingsOf,
  defaultAutomationContent,
  isValidCalendarDate,
  logEntryFor,
  mergeLog,
  planAutomations,
  todayIn,
} from "@/lib/mailer/automations";
import { cleanBrandInput, INLINE_LOGO_MAX_CHARS } from "@/lib/mailer/brand";
import { contactDisplayName, isValidEmail, normalizeEmail } from "@/lib/mailer/email";
import { resolveAudience } from "@/lib/mailer/audience";
import { createDemoData } from "@/lib/mailer/seed";
import { simulateSend } from "@/lib/mailer/simulate";
import { MailerError, type MailerRepository } from "@/features/mailer/repository/types";

/**
 * Mock-mode repository: the whole Mailer dataset is one JSON document in
 * the browser's LocalStorage, seeded with demo data on first use.
 * Data stays in this browser only — it never reaches Supabase, other
 * admins or other devices.
 *
 * Storage is injectable so tests (tests/mailer.cjs) can use an in-memory
 * store; when LocalStorage is unavailable (private window, blocked site
 * data) it falls back to memory for the session instead of crashing.
 */

export const MAILER_STORAGE_KEY = "everymoment.mailer.v1";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

export function browserStore(): KeyValueStore {
  try {
    const probe = "__everymoment_mailer_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return memoryStore();
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function looksLikeMailerData(value: unknown): value is MailerData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    ["events", "contacts", "lists", "templates", "campaigns"].every((k) => Array.isArray(v[k]))
  );
}

function cleanText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export class LocalStorageMailerRepository implements MailerRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly clock: () => number = Date.now,
  ) {}

  // --- storage --------------------------------------------------------

  private read(): MailerData {
    const raw = this.store.getItem(MAILER_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (looksLikeMailerData(parsed)) {
          // Contacts saved before roles/dates existed have no such fields.
          for (const c of parsed.contacts) {
            c.roles = normalizeRoles(c.roles);
            c.dateOfBirth ??= "";
            c.joiningDate ??= "";
          }
          return parsed;
        }
      } catch {
        // fall through and reseed
      }
      console.warn("Mailer: stored data was unreadable, restoring the demo data.");
    }
    const seeded = createDemoData({ now: this.clock(), newId });
    this.write(seeded);
    return seeded;
  }

  private write(data: MailerData): void {
    try {
      this.store.setItem(MAILER_STORAGE_KEY, JSON.stringify(data));
    } catch {
      throw new MailerError("Couldn't save — this browser's storage is full or blocked.");
    }
  }

  private update<T>(fn: (data: MailerData) => T): T {
    const data = this.read();
    const result = fn(data);
    this.write(data);
    return result;
  }

  private now(): string {
    return new Date(this.clock()).toISOString();
  }

  // --- reads ----------------------------------------------------------

  async load(): Promise<MailerData> {
    return structuredClone(this.read());
  }

  async listEvents() {
    return structuredClone(this.read().events);
  }

  // --- contacts -------------------------------------------------------

  private cleanDate(value: unknown, label: string, notAfterToday: boolean): string {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return "";
    if (!isValidCalendarDate(text)) throw new MailerError(`${label} isn't a valid date.`);
    if (notAfterToday && text > todayIn(this.clock())) throw new MailerError(`${label} can't be in the future.`);
    return text;
  }

  private cleanContact(input: MailerContactInput, data: MailerData, id?: string): Omit<MailerContact, "id" | "createdAt" | "updatedAt"> {
    const email = normalizeEmail(input.email);
    if (!email) throw new MailerError("Please enter an email address.");
    if (!isValidEmail(email)) throw new MailerError(`"${input.email.trim()}" isn't a valid email address.`);
    const clash = data.contacts.find((c) => c.email === email && c.id !== id);
    if (clash) throw new MailerError(`${email} is already a contact (${contactDisplayName(clash)}).`);
    const eventIds = new Set(data.events.map((e) => e.id));
    return {
      firstName: cleanText(input.firstName, 80),
      lastName: cleanText(input.lastName, 80),
      email,
      company: cleanText(input.company, 120),
      phone: cleanText(input.phone, 40),
      eventIds: [...new Set(input.eventIds)].filter((e) => eventIds.has(e)),
      roles: normalizeRoles(input.roles),
      dateOfBirth: this.cleanDate(input.dateOfBirth, "Date of birth", true),
      joiningDate: this.cleanDate(input.joiningDate, "Joining date", false),
      subscribed: input.subscribed,
    };
  }

  async saveContact(input: MailerContactInput, id?: string): Promise<MailerContact> {
    return this.update((data) => {
      const clean = this.cleanContact(input, data, id);
      const now = this.now();
      if (id) {
        const existing = data.contacts.find((c) => c.id === id);
        if (!existing) throw new MailerError("That contact no longer exists.");
        Object.assign(existing, clean, { updatedAt: now });
        return structuredClone(existing);
      }
      const contact: MailerContact = { ...clean, id: newId(), createdAt: now, updatedAt: now };
      data.contacts.push(contact);
      return structuredClone(contact);
    });
  }

  async deleteContact(id: string): Promise<void> {
    this.update((data) => {
      data.contacts = data.contacts.filter((c) => c.id !== id);
      for (const list of data.lists) list.contactIds = list.contactIds.filter((c) => c !== id);
      // Drafts lose the contact; sent campaigns keep their recipient snapshot for analytics.
      for (const campaign of data.campaigns) {
        if (campaign.status === "draft") campaign.audience.contactIds = campaign.audience.contactIds.filter((c) => c !== id);
      }
    });
  }

  async importContacts(inputs: MailerContactInput[], listId?: string | null): Promise<MailerContact[]> {
    return this.update((data) => {
      const list = listId ? data.lists.find((l) => l.id === listId) : null;
      if (listId && !list) throw new MailerError("That list no longer exists.");
      const now = this.now();
      const created: MailerContact[] = [];
      for (const input of inputs) {
        // Re-checked here too: the CSV analysis may be stale if contacts changed meanwhile.
        let clean: Omit<MailerContact, "id" | "createdAt" | "updatedAt">;
        try {
          clean = this.cleanContact(input, data);
        } catch {
          continue;
        }
        const contact: MailerContact = { ...clean, id: newId(), createdAt: now, updatedAt: now };
        data.contacts.push(contact);
        created.push(contact);
      }
      if (list) {
        list.contactIds = [...new Set([...list.contactIds, ...created.map((c) => c.id)])];
        list.updatedAt = now;
      }
      return structuredClone(created);
    });
  }

  // --- lists ----------------------------------------------------------

  async saveList(input: MailerListInput, id?: string): Promise<MailerList> {
    return this.update((data) => {
      const name = cleanText(input.name, 80);
      if (!name) throw new MailerError("Please give the list a name.");
      if (data.lists.some((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== id)) {
        throw new MailerError(`There's already a list called "${name}".`);
      }
      const known = new Set(data.contacts.map((c) => c.id));
      const clean = {
        name,
        description: cleanText(input.description, 300),
        contactIds: [...new Set(input.contactIds)].filter((c) => known.has(c)),
      };
      const now = this.now();
      if (id) {
        const existing = data.lists.find((l) => l.id === id);
        if (!existing) throw new MailerError("That list no longer exists.");
        Object.assign(existing, clean, { updatedAt: now });
        return structuredClone(existing);
      }
      const list: MailerList = { ...clean, id: newId(), createdAt: now, updatedAt: now };
      data.lists.push(list);
      return structuredClone(list);
    });
  }

  async deleteList(id: string): Promise<void> {
    this.update((data) => {
      data.lists = data.lists.filter((l) => l.id !== id);
      for (const campaign of data.campaigns) {
        if (campaign.status === "draft") campaign.audience.listIds = campaign.audience.listIds.filter((l) => l !== id);
      }
    });
  }

  // --- templates ------------------------------------------------------

  async saveTemplate(input: MailerTemplateInput, id?: string): Promise<MailerTemplate> {
    return this.update((data) => {
      const name = cleanText(input.name, 80);
      if (!name) throw new MailerError("Please give the template a name.");
      if (!input.subject.trim()) throw new MailerError("Please add a subject line.");
      const clean = {
        name,
        kind: input.kind,
        subject: cleanText(input.subject, 200),
        preheader: cleanText(input.preheader, 200),
        body: input.body.slice(0, 10_000),
        ctaLabel: cleanText(input.ctaLabel, 60),
        ctaUrl: cleanText(input.ctaUrl, 500),
      };
      const now = this.now();
      if (id) {
        const existing = data.templates.find((t) => t.id === id);
        if (!existing) throw new MailerError("That template no longer exists.");
        Object.assign(existing, clean, { updatedAt: now });
        return structuredClone(existing);
      }
      const template: MailerTemplate = { ...clean, id: newId(), builtIn: false, updatedAt: now };
      data.templates.push(template);
      return structuredClone(template);
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    this.update((data) => {
      const template = data.templates.find((t) => t.id === id);
      if (template?.builtIn) throw new MailerError("Built-in templates can't be deleted — edit them instead.");
      data.templates = data.templates.filter((t) => t.id !== id);
      for (const campaign of data.campaigns) if (campaign.templateId === id) campaign.templateId = null;
    });
  }

  // --- campaigns ------------------------------------------------------

  async saveCampaign(input: MailerCampaignInput, id?: string): Promise<MailerCampaign> {
    return this.update((data) => {
      const name = cleanText(input.name, 120);
      if (!name) throw new MailerError("Please give the campaign a name.");
      const contactIds = new Set(data.contacts.map((c) => c.id));
      const listIds = new Set(data.lists.map((l) => l.id));
      const clean = {
        name,
        kind: input.kind,
        templateId: input.templateId && data.templates.some((t) => t.id === input.templateId) ? input.templateId : null,
        senderName: cleanText(input.senderName, 80),
        eventId: input.eventId && data.events.some((e) => e.id === input.eventId) ? input.eventId : null,
        showLogo: input.showLogo !== false,
        audience: {
          contactIds: [...new Set(input.audience.contactIds)].filter((c) => contactIds.has(c)),
          listIds: [...new Set(input.audience.listIds)].filter((l) => listIds.has(l)),
        },
        subject: cleanText(input.subject, 200),
        preheader: cleanText(input.preheader, 200),
        body: input.body.slice(0, 10_000),
        ctaLabel: cleanText(input.ctaLabel, 60),
        ctaUrl: cleanText(input.ctaUrl, 500),
      };
      const now = this.now();
      if (id) {
        const existing = data.campaigns.find((c) => c.id === id);
        if (!existing) throw new MailerError("That campaign no longer exists.");
        if (existing.status !== "draft") throw new MailerError("This campaign has already been sent and can't be edited.");
        Object.assign(existing, clean, { updatedAt: now });
        return structuredClone(existing);
      }
      const campaign: MailerCampaign = {
        ...clean,
        id: newId(),
        status: "draft",
        simulated: true,
        recipients: [],
        createdAt: now,
        updatedAt: now,
        sentAt: null,
      };
      data.campaigns.push(campaign);
      return structuredClone(campaign);
    });
  }

  async deleteCampaign(id: string): Promise<void> {
    this.update((data) => {
      data.campaigns = data.campaigns.filter((c) => c.id !== id);
    });
  }

  async sendCampaign(id: string): Promise<MailerCampaign> {
    return this.update((data) => {
      const campaign = data.campaigns.find((c) => c.id === id);
      if (!campaign) throw new MailerError("That campaign no longer exists.");
      if (campaign.status !== "draft") throw new MailerError("This campaign has already been sent.");
      if (!campaign.subject.trim()) throw new MailerError("Add a subject line before sending.");
      if (!campaign.body.trim()) throw new MailerError("Add a message before sending.");
      if (campaign.kind === "invitation" && !campaign.eventId) throw new MailerError("Pick the event this invitation is for.");

      const { recipients } = resolveAudience(campaign.audience, data.contacts, data.lists);
      if (recipients.length === 0) throw new MailerError("No subscribed contacts selected — pick at least one contact or list.");

      const nowMs = this.clock();
      campaign.recipients = simulateSend(
        recipients.map((c) => ({ contactId: c.id, email: c.email, name: contactDisplayName(c) })),
        { now: nowMs },
      );
      campaign.status = "sent";
      campaign.simulated = true;
      campaign.sentAt = new Date(nowMs).toISOString();
      campaign.updatedAt = campaign.sentAt;
      return structuredClone(campaign);
    });
  }

  async listSenders() {
    return []; // mock mode never sends for real
  }

  // --- automations (birthdays, work anniversaries) ---------------------

  async saveAutomationSettings(input: AutomationSettings): Promise<AutomationSettings> {
    return this.update((data) => {
      const current = automationSettingsOf(data);
      const next: AutomationSettings = {
        rules: { ...current.rules },
        senderId: typeof input?.senderId === "string" && input.senderId ? input.senderId.slice(0, 64) : null,
        senderName: typeof input?.senderName === "string" ? cleanText(input.senderName, 80) : "",
      };
      for (const { kind, label } of AUTOMATION_KINDS) {
        const rule = input?.rules?.[kind];
        if (!rule) continue;
        const c = rule.content ?? defaultAutomationContent(kind);
        const content = {
          subject: cleanText(String(c.subject ?? ""), 200),
          preheader: cleanText(String(c.preheader ?? ""), 200),
          body: String(c.body ?? "").slice(0, 10_000),
          ctaLabel: cleanText(String(c.ctaLabel ?? ""), 60),
          ctaUrl: cleanText(String(c.ctaUrl ?? ""), 500),
        };
        if (rule.enabled && (!content.subject || !content.body.trim())) {
          throw new MailerError(`${label}: add a subject and a message before turning it on.`);
        }
        next.rules[kind] = { enabled: Boolean(rule.enabled), content };
      }
      data.automations = next;
      return structuredClone(next);
    });
  }

  /** Mock mode: works out what would be sent today (or on `date`) and logs it as simulated — nothing is sent. */
  async runAutomations(options?: { date?: string | null }): Promise<AutomationRunResult> {
    return this.update((data) => {
      const date = options?.date && isValidCalendarDate(options.date) ? options.date : todayIn(this.clock());
      const at = this.now();
      const entries = planAutomations(data, date).map((job) => logEntryFor(job, "simulated", null, at));
      data.automationLog = mergeLog(data.automationLog, entries);
      return { date, entries };
    });
  }

  // --- brand ------------------------------------------------------------

  async saveBrandSettings(input: MailerBrandInput): Promise<MailerBrand> {
    const clean = cleanBrandInput(input);
    if (!clean.ok) throw new MailerError(clean.error);
    return this.update((data) => {
      data.brand = { ...clean.value, updatedAt: this.now() };
      return structuredClone(data.brand);
    });
  }

  /** Mock mode: the logo stays in this browser, inline in the saved data. */
  async uploadLogo(png: Blob): Promise<string> {
    if (png.type !== "image/png") throw new MailerError("The logo couldn't be prepared — try another image.");
    const bytes = new Uint8Array(await png.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const url = `data:image/png;base64,${btoa(binary)}`;
    if (url.length > INLINE_LOGO_MAX_CHARS) throw new MailerError("That logo is too large to keep in this browser — try a smaller image.");
    return url;
  }

  async resetDemoData(): Promise<void> {
    this.write(createDemoData({ now: this.clock(), newId }));
  }
}
