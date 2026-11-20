import "server-only";
import { randomUUID } from "node:crypto";

import type {
  AutomationLogEntry,
  AutomationRunResult,
  CampaignRecipient,
  MailerContact,
  MailerData,
  MailerEvent,
  MailerSender,
} from "@/types/mailer";
import type { EmailConfigView } from "@/types/mailer-email-config";
import {
  applyAutomationTokens,
  AUTOMATION_SEND_HOUR,
  automationSettingsOf,
  hourIn,
  isValidCalendarDate,
  logEntryFor,
  mergeLog,
  planAutomations,
  todayIn,
  type AutomationJob,
} from "@/lib/mailer/automations";
import { contactDisplayName } from "@/lib/mailer/email";
import { resolveAudience } from "@/lib/mailer/audience";
import { createDemoData } from "@/lib/mailer/seed";
import { tokenValuesFor } from "@/lib/mailer/tokens";
import { renderEmail } from "@/lib/mailer/email-html";
import { canSendWith } from "@/lib/mailer/email-config/status";
import { LocalStorageMailerRepository, MAILER_STORAGE_KEY, memoryStore } from "@/features/mailer/repository/local-storage-repository";
import { MailerError } from "@/features/mailer/repository/types";
import { mailerFirestore, MailerFirestoreSetupError, mailerTenantDoc } from "@/services/mailer-firestore";
import { EmailConfigError, listEmailConfigs, loadTransportForConfig, type ConfigTransport } from "@/services/mailer-email-config/store";
import { EmailDeliveryError, type EmailTransport, type OutgoingEmail } from "@/services/mailer-email-config/transport";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "@/services/mailer/unsubscribe-token";

/**
 * Live Event Mailer: contacts, lists, templates and campaigns in Firestore
 * (one document per company: mailerTenants/{tenantId}/mailer/data), and
 * campaigns sent for real through the company's own verified Email
 * Configuration.
 *
 * The data rules are the same code mock mode runs
 * (LocalStorageMailerRepository) — here it works on a copy of the Firestore
 * document inside a transaction, so validation can't drift between modes.
 *
 * Callers resolve `tenantId` server-side (the signed-in account, or the
 * dev preview's pretend company) — never from the browser.
 */

/** Firestore's limit is 1 MiB per document; stop well before it. */
const MAX_DATA_BYTES = 900_000;
/** One send runs inside one request, so keep a campaign to a size that finishes. */
export const MAX_LIVE_RECIPIENTS = 300;
/** Gap between messages, so providers don't throttle or flag the burst. */
const SEND_GAP_MS = 300;
const RETRY_DELAY_MS = 2_000;
const PROGRESS_EVERY = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dataRef(tenantId: string) {
  return mailerTenantDoc(tenantId).collection("mailer").doc("data");
}

/** A new company starts with the built-in templates and sample events, but no demo people. */
function startingData(): MailerData {
  const demo = createDemoData({ newId: randomUUID });
  return { ...demo, contacts: [], lists: [], campaigns: [] };
}

function parseData(json: unknown): MailerData {
  if (typeof json === "string") {
    try {
      const parsed = JSON.parse(json) as MailerData;
      if (parsed?.version === 1 && Array.isArray(parsed.contacts) && Array.isArray(parsed.campaigns)) return parsed;
    } catch {
      // fall through
    }
  }
  throw new MailerError("The saved Mailer data couldn't be read.");
}

/** Firestore/setup failures become short messages; MailerErrors pass through. */
async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof MailerError) throw err;
    if (err instanceof EmailConfigError) throw new MailerError(err.message);
    if (err instanceof MailerFirestoreSetupError) throw new MailerError(err.message);
    console.error("[mailer] live data operation failed", { code: (err as { code?: unknown }).code, name: (err as Error)?.name });
    throw new MailerError("Couldn't reach the Mailer database. Please try again.");
  }
}

/**
 * Reads the company's Mailer data, lets `mutate` change it, and writes it
 * back — atomically (a Firestore transaction, retried on conflicts, so
 * `mutate` must not have side effects outside `data`).
 */
async function withMailerData<T>(tenantId: string, mutate: (data: MailerData) => T | Promise<T>, options: { create?: boolean } = {}): Promise<T> {
  const create = options.create ?? true;
  const ref = dataRef(tenantId);
  return mailerFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? String(snap.get("json")) : null;
    const data = before ? parseData(before) : startingData();
    const result = await mutate(data);
    const after = JSON.stringify(data);
    if (after !== before && (snap.exists || create)) {
      if (after.length > MAX_DATA_BYTES) {
        throw new MailerError("The Mailer is full — delete old campaigns or contacts you no longer need, then try again.");
      }
      tx.set(ref, { json: after, updatedAt: new Date().toISOString() });
    }
    return result;
  });
}

// --- the repository methods ---------------------------------------------

const REPOSITORY_METHODS = new Set([
  "load",
  "listEvents",
  "saveContact",
  "deleteContact",
  "importContacts",
  "saveList",
  "deleteList",
  "saveTemplate",
  "deleteTemplate",
  "saveCampaign",
  "deleteCampaign",
  "saveAutomationSettings",
]);

/** Runs one MailerRepository method against the company's Firestore data. */
export async function runMailerMethod(tenantId: string, method: string, args: unknown[]): Promise<unknown> {
  if (!Array.isArray(args) || args.length > 2) throw new MailerError("That request isn't valid.");
  if (method === "listSenders") return listSenders(tenantId);
  if (method === "resetDemoData") throw new MailerError("Demo data is only available in mock mode.");
  if (!REPOSITORY_METHODS.has(method)) throw new MailerError("That request isn't valid.");

  return guard(() =>
    withMailerData(tenantId, async (data) => {
      const store = memoryStore();
      store.setItem(MAILER_STORAGE_KEY, JSON.stringify(data));
      const repo = new LocalStorageMailerRepository(store);
      const fn = (repo as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!;
      let result: unknown;
      try {
        result = await fn.apply(repo, args);
      } catch (err) {
        // Bad input shapes from the browser surface as TypeErrors inside the rules.
        if (err instanceof MailerError) throw err;
        throw new MailerError("That request isn't valid.");
      }
      Object.assign(data, JSON.parse(store.getItem(MAILER_STORAGE_KEY)!) as MailerData);
      return result;
    }),
  );
}

// --- senders --------------------------------------------------------------

export async function listSenders(tenantId: string): Promise<MailerSender[]> {
  const configs = await guard(() => listEmailConfigs(tenantId));
  return configs
    .filter((c) => canSendWith(c).ok)
    .map((c) => ({ id: c.id, label: c.label, senderName: c.senderName, fromEmail: c.fromEmail, isDefault: c.isDefault }));
}

/** The verified Email Configuration to send from: the one picked, else the default verified one. */
async function resolveSender(tenantId: string, senderId: string | null | undefined): Promise<EmailConfigView> {
  const configs = await guard(() => listEmailConfigs(tenantId));
  const usable = configs.filter((c) => canSendWith(c).ok);
  const config = senderId ? configs.find((c) => c.id === senderId) : (usable.find((c) => c.isDefault) ?? usable[0]);
  if (!config) {
    throw new MailerError(
      senderId
        ? "That email configuration doesn't exist."
        : "There's no verified email configuration yet. Open Email Settings, test the connection and send a test email first.",
    );
  }
  const allowed = canSendWith(config);
  if (!allowed.ok) throw new MailerError(allowed.reason);
  if (!createUnsubscribeToken(tenantId, "check")) {
    throw new MailerError("Unsubscribe links need MAILER_CREDENTIAL_ENCRYPTION_KEY on the server.");
  }
  return config;
}

// --- live send ------------------------------------------------------------

type Outcome = Pick<CampaignRecipient, "status" | "providerMessageId" | "error" | "events">;

async function sendOne(transport: EmailTransport, email: OutgoingEmail): Promise<Outcome> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const { messageId } = await transport.send(email);
      return { status: "sent", providerMessageId: messageId, error: null, events: [{ type: "sent", at: new Date().toISOString() }] };
    } catch (err) {
      const safe = err instanceof EmailDeliveryError ? err.safe : null;
      if (safe?.retryable && attempt < 2) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      const message = err instanceof EmailDeliveryError ? err.message : "Something went wrong sending to this address.";
      return { status: "failed", providerMessageId: null, error: message, events: [{ type: "failed", at: new Date().toISOString() }] };
    }
  }
}

async function saveProgress(tenantId: string, campaignId: string, outcomes: Map<string, Outcome>, done: boolean) {
  return guard(() =>
    withMailerData(tenantId, (data) => {
      const campaign = data.campaigns.find((c) => c.id === campaignId);
      if (!campaign) return null; // deleted while sending
      for (const r of campaign.recipients) {
        const outcome = outcomes.get(r.contactId);
        if (outcome) Object.assign(r, outcome);
      }
      if (done && campaign.delivery) {
        campaign.delivery.state = "done";
        campaign.delivery.finishedAt = new Date().toISOString();
      }
      campaign.updatedAt = new Date().toISOString();
      return structuredClone(campaign);
    }),
  );
}

/**
 * Sends a draft campaign for real. The campaign is claimed first (marked
 * sent, every recipient "queued") in one transaction, so a double click or
 * a second tab can't send it twice; then each person gets their own
 * personalised message with their own unsubscribe link.
 *
 * `origin` is where this app is reachable, for the unsubscribe links.
 */
export async function sendCampaignLive(tenantId: string, campaignId: unknown, senderId: unknown, origin: string) {
  if (typeof campaignId !== "string" || !campaignId) throw new MailerError("That campaign no longer exists.");
  if (senderId !== null && senderId !== undefined && typeof senderId !== "string") throw new MailerError("Pick who the campaign is sent from.");

  const config = await resolveSender(tenantId, senderId);

  const claim = await guard(() =>
    withMailerData(tenantId, (data) => {
      const campaign = data.campaigns.find((c) => c.id === campaignId);
      if (!campaign) throw new MailerError("That campaign no longer exists.");
      if (campaign.status !== "draft") throw new MailerError("This campaign has already been sent.");
      if (!campaign.subject.trim()) throw new MailerError("Add a subject line before sending.");
      if (!campaign.body.trim()) throw new MailerError("Add a message before sending.");
      if (campaign.kind === "invitation" && !campaign.eventId) throw new MailerError("Pick the event this invitation is for.");

      const { recipients } = resolveAudience(campaign.audience, data.contacts, data.lists);
      if (recipients.length === 0) throw new MailerError("No subscribed contacts selected — pick at least one contact or list.");
      if (recipients.length > MAX_LIVE_RECIPIENTS) {
        throw new MailerError(`One campaign can go to at most ${MAX_LIVE_RECIPIENTS} people for now — split the audience into smaller lists.`);
      }

      const now = new Date().toISOString();
      campaign.status = "sent";
      campaign.simulated = false;
      campaign.sentAt = now;
      campaign.updatedAt = now;
      campaign.delivery = {
        state: "sending",
        senderId: config.id,
        senderLabel: config.label,
        fromName: campaign.senderName.trim() || config.senderName,
        fromEmail: config.fromEmail,
        startedAt: now,
        finishedAt: null,
      };
      campaign.recipients = recipients.map((c) => ({
        contactId: c.id,
        email: c.email,
        name: contactDisplayName(c),
        status: "queued",
        providerMessageId: null,
        error: null,
        events: [],
      }));
      const event: MailerEvent | null = data.events.find((e) => e.id === campaign.eventId) ?? null;
      return { campaign: structuredClone(campaign), contacts: structuredClone(recipients) as MailerContact[], event };
    }),
  );

  const { campaign, contacts, event } = claim;
  const delivery = campaign.delivery!;
  const outcomes = new Map<string, Outcome>();
  let loaded: ConfigTransport | null = null;

  try {
    try {
      loaded = await loadTransportForConfig(tenantId, config.id);
    } catch (err) {
      const message = err instanceof EmailDeliveryError || err instanceof EmailConfigError ? err.message : "Couldn't connect to your email server.";
      const at = new Date().toISOString();
      for (const c of contacts) outcomes.set(c.id, { status: "failed", providerMessageId: null, error: message, events: [{ type: "failed", at }] });
      return await saveProgress(tenantId, campaign.id, outcomes, true);
    }

    for (const [i, contact] of contacts.entries()) {
      const token = createUnsubscribeToken(tenantId, contact.id)!;
      const unsubscribeUrl = `${origin}/mailer/unsubscribe?t=${encodeURIComponent(token)}`;
      const rendered = renderEmail(campaign.kind, campaign, tokenValuesFor(contact, event, delivery.fromName), { unsubscribeUrl });
      outcomes.set(
        contact.id,
        await sendOne(loaded.transport, {
          from: { name: delivery.fromName, address: delivery.fromEmail },
          replyTo: config.replyToEmail ? { name: config.replyToName, address: config.replyToEmail } : null,
          to: contact.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
        }),
      );
      if ((i + 1) % PROGRESS_EVERY === 0 && i + 1 < contacts.length) await saveProgress(tenantId, campaign.id, outcomes, false).catch(() => null);
      if (i + 1 < contacts.length) await sleep(SEND_GAP_MS);
    }
    await loaded.rotateIfNeeded().catch(() => {});
  } finally {
    loaded?.transport.close();
  }

  return saveProgress(tenantId, campaign.id, outcomes, true);
}

// --- birthday / work-anniversary automations --------------------------------

/**
 * Sends the automatic emails due on `date` (default: today, India time)
 * for one company. Jobs are claimed first (logged as "sending" in one
 * transaction), so overlapping runs — the daily job and a "Run now" click —
 * can't send the same email twice. Failed ones are retried on the next run.
 */
export async function runAutomationsLive(tenantId: string, options: { date?: unknown; origin: string }): Promise<AutomationRunResult> {
  const date = typeof options.date === "string" && isValidCalendarDate(options.date) ? options.date : todayIn(Date.now());

  const claim = await guard(() =>
    withMailerData(
      tenantId,
      (data) => {
        const settings = automationSettingsOf(data);
        const jobs = planAutomations(data, date);
        if (jobs.length) {
          const at = new Date().toISOString();
          data.automationLog = mergeLog(data.automationLog, jobs.map((j) => logEntryFor(j, "sending", null, at)));
        }
        return { settings, jobs: structuredClone(jobs) as AutomationJob[] };
      },
      { create: false },
    ),
  );
  const { settings, jobs } = claim;
  if (jobs.length === 0) return { date, entries: [] };

  const results: AutomationLogEntry[] = [];
  const finish = async () => {
    await guard(() => withMailerData(tenantId, (data) => void (data.automationLog = mergeLog(data.automationLog, results)), { create: false }));
    return { date, entries: results };
  };
  const failAll = (message: string) => {
    const at = new Date().toISOString();
    for (const job of jobs) results.push(logEntryFor(job, "failed", message, at));
  };

  let config: EmailConfigView;
  try {
    config = await resolveSender(tenantId, settings.senderId);
  } catch (err) {
    failAll(err instanceof MailerError ? err.message : "Couldn't pick the email configuration to send from.");
    return finish();
  }

  let loaded: ConfigTransport | null = null;
  try {
    try {
      loaded = await loadTransportForConfig(tenantId, config.id);
    } catch (err) {
      failAll(err instanceof EmailDeliveryError || err instanceof EmailConfigError ? err.message : "Couldn't connect to your email server.");
      return await finish();
    }
    const fromName = settings.senderName.trim() || config.senderName;
    for (const [i, job] of jobs.entries()) {
      const token = createUnsubscribeToken(tenantId, job.recipient.id)!;
      const unsubscribeUrl = `${options.origin}/mailer/unsubscribe?t=${encodeURIComponent(token)}`;
      const content = applyAutomationTokens(settings.rules[job.kind].content, job.tokens);
      const rendered = renderEmail(job.kind, content, tokenValuesFor(job.recipient, null, fromName), { unsubscribeUrl });
      const outcome = await sendOne(loaded.transport, {
        from: { name: fromName, address: config.fromEmail },
        replyTo: config.replyToEmail ? { name: config.replyToName, address: config.replyToEmail } : null,
        to: job.recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
      });
      results.push(logEntryFor(job, outcome.status === "sent" ? "sent" : "failed", outcome.error, new Date().toISOString()));
      if (i + 1 < jobs.length) await sleep(SEND_GAP_MS);
    }
  } finally {
    loaded?.transport.close();
  }
  return finish();
}

/**
 * The daily job (app/api/cron/mailer-automations): every company with an
 * automation switched on, once it's past AUTOMATION_SEND_HOUR in India.
 * Safe to call as often as you like — already-sent emails are skipped.
 */
export async function runAutomationsForAllTenants(origin: string, nowMs = Date.now()) {
  if (hourIn(nowMs) < AUTOMATION_SEND_HOUR) return { ran: false as const, reason: `waiting until ${AUTOMATION_SEND_HOUR}:00 India time`, tenants: 0, sent: 0, failed: 0 };
  const refs = await mailerFirestore().collection("mailerTenants").listDocuments();
  let tenants = 0;
  let sent = 0;
  let failed = 0;
  for (const ref of refs) {
    try {
      const snap = await dataRef(ref.id).get();
      if (!snap.exists) continue;
      const settings = automationSettingsOf(parseData(snap.get("json")));
      if (!Object.values(settings.rules).some((r) => r.enabled)) continue;
      tenants += 1;
      const result = await runAutomationsLive(ref.id, { origin });
      sent += result.entries.filter((e) => e.status === "sent").length;
      failed += result.entries.filter((e) => e.status === "failed").length;
    } catch (err) {
      // One company's problem mustn't stop the others.
      console.error("[mailer] automations failed for a tenant", { name: (err as Error)?.name });
    }
  }
  return { ran: true as const, reason: null, tenants, sent, failed };
}

// --- unsubscribe ----------------------------------------------------------

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(6, local.length - 2)))}@${domain}`;
}

/** For the unsubscribe page: who the link is for (masked), without changing anything. */
export async function describeUnsubscribe(token: unknown): Promise<{ maskedEmail: string; subscribed: boolean } | null> {
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) return null;
  try {
    const snap = await dataRef(parsed.tenantId).get();
    if (!snap.exists) return null;
    const contact = parseData(snap.get("json")).contacts.find((c) => c.id === parsed.contactId);
    return contact ? { maskedEmail: maskEmail(contact.email), subscribed: contact.subscribed } : null;
  } catch {
    return null;
  }
}

/** Marks the contact unsubscribed. Returns false when the link is invalid or the contact is gone. */
export async function unsubscribeByToken(token: unknown): Promise<boolean> {
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) return false;
  try {
    return await withMailerData(
      parsed.tenantId,
      (data) => {
        const contact = data.contacts.find((c) => c.id === parsed.contactId);
        if (!contact) return false;
        if (contact.subscribed) {
          contact.subscribed = false;
          contact.updatedAt = new Date().toISOString();
        }
        return true;
      },
      { create: false },
    );
  } catch (err) {
    console.error("[mailer] unsubscribe failed", { name: (err as Error)?.name });
    return false;
  }
}
