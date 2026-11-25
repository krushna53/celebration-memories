import "server-only";
import { randomUUID } from "node:crypto";

import type { EmailConfigInput, EmailConfigView } from "@/types/mailer-email-config";
import { isValidEmail, normalizeEmail } from "@/lib/mailer/email";
import { getProvider } from "@/lib/mailer/email-config/providers";
import { changeResetsVerification } from "@/lib/mailer/email-config/status";
import { emailDomain, validateEmailConfig, type CleanEmailConfig } from "@/lib/mailer/email-config/validation";
import { SmtpSafeError } from "@/lib/mailer/email-config/smtp-errors";
import { localSmtpAllowed } from "@/lib/mailer/email-config/local-smtp";
import {
  credentialKeysFromEnv,
  decryptCredential,
  encryptCredential,
  needsReencryption,
} from "@/services/mailer-email-config/secret-box";
import { createSmtpTransport, EmailDeliveryError, type EmailTransport, type OutgoingEmail } from "@/services/mailer-email-config/transport";
import { createResendTransport } from "@/services/mailer-email-config/resend-transport";
import { checkDomain } from "@/services/mailer-email-config/dns-check";
import {
  configuredBackendName,
  EmailConfigError,
  type BackendName,
  type ConfigRow,
  type EmailConfigBackend,
  type SecretMeta,
} from "@/services/mailer-email-config/backend";
import { supabaseBackend } from "@/services/mailer-email-config/supabase-backend";
import { firestoreBackend } from "@/services/mailer-email-config/firestore-backend";

/**
 * Company email configurations — stored in Supabase (migration
 * 20261117120000_mailer_email_configs.sql) or Firestore, picked by
 * MAILER_EMAIL_CONFIG_STORE (see backend.ts).
 *
 * Tenant isolation: every function takes `tenantId` — the signed-in
 * admin's own account id, resolved server-side by the caller — and every
 * read and write is scoped to it. A config id from the browser is only ever
 * looked up together with that tenant, so one company can't read, test or
 * send with another company's configuration even by guessing ids.
 *
 * Secrets: only loadTransportForConfig() reads the encrypted password, and
 * it hands back a ready transport, not the password. Nothing exported here
 * returns a password or ciphertext.
 */

export { EmailConfigError };

function db(): EmailConfigBackend {
  return configuredBackendName() === "firestore" ? firestoreBackend : supabaseBackend;
}

/** Which store Email Configuration is using on this server. */
export function emailConfigBackendName(): BackendName {
  return configuredBackendName();
}

function toView(row: ConfigRow, secret: SecretMeta | undefined): EmailConfigView {
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    senderName: row.sender_name,
    fromEmail: row.from_email,
    replyToEmail: row.reply_to_email,
    replyToName: row.reply_to_name,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    encryption: row.smtp_encryption,
    smtpUsername: row.smtp_username,
    authEnabled: row.auth_enabled,
    isDefault: row.is_default,
    sendingEnabled: row.sending_enabled,
    dkimSelector: row.dkim_selector,
    hasPassword: Boolean(secret),
    passwordUpdatedAt: secret?.updated_at ?? null,
    connectionStatus: row.connection_status,
    connectionCheckedAt: row.connection_checked_at,
    connectionError: row.connection_error,
    verifiedAt: row.verified_at,
    domainCheck: row.domain_check,
    updatedAt: row.updated_at,
  };
}

function toClean(row: ConfigRow): CleanEmailConfig {
  return {
    label: row.label,
    provider: row.provider,
    senderName: row.sender_name,
    fromEmail: row.from_email,
    replyToEmail: row.reply_to_email,
    replyToName: row.reply_to_name,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    encryption: row.smtp_encryption,
    smtpUsername: row.smtp_username,
    authEnabled: row.auth_enabled,
    newPassword: null,
    dkimSelector: row.dkim_selector,
    isDefault: row.is_default,
    sendingEnabled: row.sending_enabled,
  };
}

// --- reads ---------------------------------------------------------------

async function getRow(tenantId: string, id: string): Promise<ConfigRow> {
  const row = await db().getConfig(tenantId, id);
  if (!row || row.tenant_user_id !== tenantId) throw new EmailConfigError("That email configuration doesn't exist (or belongs to another account).");
  return row;
}

function secretMeta(tenantId: string, ids: string[]): Promise<Map<string, SecretMeta>> {
  return db().secretMeta(tenantId, ids);
}

export async function listEmailConfigs(tenantId: string): Promise<EmailConfigView[]> {
  const rows = (await db().listConfigs(tenantId)).filter((r) => r.tenant_user_id === tenantId);
  const secrets = await secretMeta(tenantId, rows.map((r) => r.id));
  return rows.map((r) => toView(r, secrets.get(r.id)));
}

async function getView(tenantId: string, id: string): Promise<EmailConfigView> {
  const row = await getRow(tenantId, id);
  return toView(row, (await secretMeta(tenantId, [id])).get(id));
}

// --- audit + rate limits -------------------------------------------------

async function audit(tenantId: string, actorId: string, action: string, configId: string | null, details: Record<string, unknown> = {}) {
  await db().insertAudit({ tenant_user_id: tenantId, actor_user_id: actorId, action, config_id: configId, details });
}

/** Caps how often a company can run tests, so the feature can't be used to hammer SMTP servers or send mail in bulk. */
async function enforceHourlyLimit(tenantId: string, action: string, limit: number, what: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const count = await db().countAuditSince(tenantId, action, since);
  if (count >= limit) throw new EmailConfigError(`You've reached the limit of ${limit} ${what} per hour. Please try again later.`);
}

export const TEST_EMAILS_PER_HOUR = 10;
export const CONNECTION_TESTS_PER_HOUR = 30;
export const DOMAIN_CHECKS_PER_HOUR = 30;

// --- save / delete -------------------------------------------------------

const AUDITED_FIELDS: (keyof CleanEmailConfig)[] = [
  "label",
  "provider",
  "senderName",
  "fromEmail",
  "replyToEmail",
  "replyToName",
  "smtpHost",
  "smtpPort",
  "encryption",
  "smtpUsername",
  "authEnabled",
  "dkimSelector",
  "isDefault",
  "sendingEnabled",
];

export async function saveEmailConfig(tenantId: string, actorId: string, input: EmailConfigInput, id?: string): Promise<EmailConfigView> {
  const existing = id ? await getRow(tenantId, id) : null;
  const hasStoredPassword = existing ? (await secretMeta(tenantId, [existing.id])).has(existing.id) : false;

  const parsed = validateEmailConfig(input, { hasStoredPassword, allowLocalSmtp: localSmtpAllowed() });
  if (!parsed.ok) throw new EmailConfigError(parsed.error);
  const clean = parsed.value;

  const keys = credentialKeysFromEnv();
  if (clean.newPassword && !keys) {
    throw new EmailConfigError("Password encryption isn't set up on the server (MAILER_CREDENTIAL_ENCRYPTION_KEY), so the password can't be saved safely.");
  }

  const configId = existing?.id ?? randomUUID();
  const before = existing ? toClean(existing) : null;
  const resetVerification = !before || changeResetsVerification(before, clean, Boolean(clean.newPassword));
  const resetDomain = !before || before.fromEmail !== clean.fromEmail || before.dkimSelector !== clean.dkimSelector || before.provider !== clean.provider;

  // The first configuration a company adds becomes its default.
  let makeDefault = clean.isDefault;
  if (!existing) {
    if ((await db().countConfigs(tenantId)) === 0) makeDefault = true;
  }
  if (makeDefault) {
    await db().clearDefaultExcept(tenantId, configId);
  }

  const now = new Date().toISOString();
  const patch = {
    label: clean.label,
    provider: clean.provider,
    sender_name: clean.senderName,
    from_email: clean.fromEmail,
    reply_to_email: clean.replyToEmail,
    reply_to_name: clean.replyToName,
    smtp_host: clean.smtpHost,
    smtp_port: clean.smtpPort,
    smtp_encryption: clean.encryption,
    smtp_username: clean.smtpUsername,
    auth_enabled: clean.authEnabled,
    is_default: makeDefault,
    sending_enabled: clean.sendingEnabled,
    dkim_selector: clean.dkimSelector,
    updated_by: actorId,
    updated_at: now,
    ...(resetVerification ? { connection_status: "untested", connection_checked_at: null, connection_error: null, verified_at: null } : {}),
    ...(resetDomain ? { domain_check: null } : {}),
  };

  if (existing) {
    await db().updateConfig(tenantId, configId, patch);
  } else {
    await db().insertConfig(tenantId, configId, { ...patch, created_by: actorId });
  }

  if (clean.newPassword && keys) {
    const { ciphertext, keyId } = encryptCredential(clean.newPassword, { tenantId, configId }, keys);
    try {
      await db().putSecret(tenantId, configId, ciphertext, keyId, now);
    } catch (err) {
      // Don't leave a brand-new configuration half-saved without its password.
      if (!existing) await db().deleteConfig(tenantId, configId).catch(() => {});
      throw err;
    }
  } else if (!clean.authEnabled) {
    await db().deleteSecret(tenantId, configId);
  }

  const changed = before ? AUDITED_FIELDS.filter((f) => before[f] !== clean[f]) : AUDITED_FIELDS;
  await audit(tenantId, actorId, existing ? "config.updated" : "config.created", configId, {
    changed,
    password_replaced: Boolean(clean.newPassword),
    verification_reset: resetVerification,
  });

  return getView(tenantId, configId);
}

export async function deleteEmailConfig(tenantId: string, actorId: string, id: string): Promise<void> {
  const row = await getRow(tenantId, id);
  await db().deleteConfig(tenantId, id);
  if (row.is_default) {
    // Hand "default" to the oldest remaining configuration, if any.
    const next = await db().oldestConfigId(tenantId);
    if (next) await db().updateConfig(tenantId, next, { is_default: true });
  }
  await audit(tenantId, actorId, "config.deleted", id, { label: row.label, from_email: row.from_email });
}

// --- transport (backend only) --------------------------------------------

export interface ConfigTransport {
  row: ConfigRow;
  transport: EmailTransport;
  /** Re-encrypts the password with the current key if it was made with an older one. */
  rotateIfNeeded(): Promise<void>;
}

/** Builds a transport from a company's own configuration. The decrypted password stays inside the transport. */
export async function loadTransportForConfig(tenantId: string, id: string): Promise<ConfigTransport> {
  const row = await getRow(tenantId, id);
  let auth: { user: string; pass: string } | null = null;
  let rotateIfNeeded = async () => {};

  if (row.auth_enabled) {
    const ciphertext = await db().getSecretCiphertext(tenantId, id);
    if (!ciphertext || !row.smtp_username) throw new EmailConfigError("This configuration has no SMTP username or password yet. Add them and save.");
    const keys = credentialKeysFromEnv();
    if (!keys) throw new EmailConfigError("Password encryption isn't set up on the server (MAILER_CREDENTIAL_ENCRYPTION_KEY).");
    const pass = decryptCredential(ciphertext, { tenantId, configId: id }, keys);
    auth = { user: row.smtp_username, pass };
    if (needsReencryption(ciphertext, keys)) {
      rotateIfNeeded = async () => {
        const fresh = encryptCredential(pass, { tenantId, configId: id }, keys);
        await db().putSecret(tenantId, id, fresh.ciphertext, fresh.keyId, new Date().toISOString());
      };
    }
  }

  // Resend: the stored "password" is the company's API key, used with Resend's HTTP API instead of SMTP.
  const transport =
    row.provider === "resend"
      ? createResendTransport(auth?.pass ?? "", row.from_email)
      : await createSmtpTransport({ host: row.smtp_host, port: row.smtp_port, encryption: row.smtp_encryption, auth });
  return { row, transport, rotateIfNeeded };
}

/** Records a test outcome — but only if the settings weren't changed while the test ran. */
async function recordOutcome(tenantId: string, row: ConfigRow, patch: Record<string, unknown>) {
  try {
    await db().updateConfig(tenantId, row.id, patch, { ifUpdatedAt: row.updated_at });
  } catch {
    // The test result itself is still returned; only the stored status is stale.
  }
}

function safeMessage(err: unknown): string {
  if (err instanceof EmailDeliveryError || err instanceof EmailConfigError || err instanceof SmtpSafeError) return err.message;
  return "Something went wrong. Please try again.";
}

export interface TestOutcome {
  ok: boolean;
  message: string;
  config: EmailConfigView;
}

export async function testEmailConfigConnection(tenantId: string, actorId: string, id: string): Promise<TestOutcome> {
  const row = await getRow(tenantId, id);
  await enforceHourlyLimit(tenantId, "connection.tested", CONNECTION_TESTS_PER_HOUR, "connection tests");

  let loaded: ConfigTransport | null = null;
  try {
    loaded = await loadTransportForConfig(tenantId, id);
    await loaded.transport.verify();
    await loaded.rotateIfNeeded();
    await recordOutcome(tenantId, row, { connection_status: "ok", connection_checked_at: new Date().toISOString(), connection_error: null });
    await audit(tenantId, actorId, "connection.tested", id, { ok: true });
    const message =
      row.provider === "resend"
        ? "Resend accepted the API key. Send a test email next to confirm the From address."
        : "Connected and signed in to the SMTP server successfully.";
    return { ok: true, message, config: await getView(tenantId, id) };
  } catch (err) {
    // Missing settings / setup problems are reported as-is, not recorded as a failed connection.
    if (err instanceof EmailConfigError) throw err;
    const message = safeMessage(err);
    const safe = err instanceof EmailDeliveryError ? err.safe : null;
    await recordOutcome(tenantId, row, { connection_status: "failed", connection_checked_at: new Date().toISOString(), connection_error: message, verified_at: null });
    await audit(tenantId, actorId, "connection.tested", id, { ok: false, kind: safe?.kind ?? "unknown", response_code: safe?.responseCode ?? null });
    return { ok: false, message, config: await getView(tenantId, id) };
  } finally {
    loaded?.transport.close();
  }
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function testEmail(row: ConfigRow, to: string): OutgoingEmail {
  const provider = getProvider(row.provider).label;
  const via = row.provider === "resend" ? "Resend API" : `${row.smtp_host}:${row.smtp_port} (${provider})`;
  const sentAt = new Date().toUTCString();
  const text = [
    `This is a test email from the EveryMoment Event Mailer.`,
    ``,
    `It was sent with the "${row.label}" email configuration:`,
    `From: ${row.sender_name} <${row.from_email}>`,
    `Sent through: ${via}`,
    `Sent: ${sentAt}`,
    ``,
    `If you received this, the sender identity works. Check that it arrived in the inbox, not spam.`,
  ].join("\n");
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f7;font-family:Helvetica,Arial,sans-serif;color:#1e1b4b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;">
<tr><td style="padding:28px 32px;">
<h1 style="margin:0 0 12px;font-size:20px;">Test email ✓</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">This is a test email from the EveryMoment Event Mailer, sent with the <strong>${esc(row.label)}</strong> email configuration.</p>
<p style="margin:0;font-size:14px;line-height:1.7;color:#4b4a6b;">From: ${esc(row.sender_name)} &lt;${esc(row.from_email)}&gt;<br>Sent through: ${esc(via)}<br>Sent: ${esc(sentAt)}</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;">If you received this, the sender identity works. Check that it arrived in the inbox, not spam.</p>
</td></tr></table></body></html>`;
  return {
    from: { name: row.sender_name, address: row.from_email },
    replyTo: row.reply_to_email ? { name: row.reply_to_name, address: row.reply_to_email } : null,
    to,
    subject: `Test email from ${row.sender_name}`,
    html,
    text,
  };
}

export async function sendEmailConfigTestEmail(tenantId: string, actorId: string, id: string, recipient: string): Promise<TestOutcome & { messageId: string | null }> {
  const to = normalizeEmail(recipient);
  if (!isValidEmail(to)) throw new EmailConfigError("Enter a valid email address to send the test email to.");
  const row = await getRow(tenantId, id);
  await enforceHourlyLimit(tenantId, "test_email.sent", TEST_EMAILS_PER_HOUR, "test emails");

  let loaded: ConfigTransport | null = null;
  try {
    loaded = await loadTransportForConfig(tenantId, id);
    const { messageId } = await loaded.transport.send(testEmail(row, to));
    await loaded.rotateIfNeeded();
    const now = new Date().toISOString();
    await recordOutcome(tenantId, row, { connection_status: "ok", connection_checked_at: now, connection_error: null, verified_at: now });
    await audit(tenantId, actorId, "test_email.sent", id, { ok: true, to: maskEmail(to), message_id: messageId });
    return {
      ok: true,
      message: `${row.provider === "resend" ? "Resend" : "The SMTP server"} accepted the test email to ${to}. Check that it arrived (and not in spam).`,
      messageId,
      config: await getView(tenantId, id),
    };
  } catch (err) {
    if (err instanceof EmailConfigError) throw err;
    const message = safeMessage(err);
    const safe = err instanceof EmailDeliveryError ? err.safe : null;
    await recordOutcome(tenantId, row, { connection_status: "failed", connection_checked_at: new Date().toISOString(), connection_error: message, verified_at: null });
    await audit(tenantId, actorId, "test_email.sent", id, { ok: false, to: maskEmail(to), kind: safe?.kind ?? "unknown", response_code: safe?.responseCode ?? null });
    return { ok: false, message, messageId: null, config: await getView(tenantId, id) };
  } finally {
    loaded?.transport.close();
  }
}

export async function checkEmailConfigDomain(tenantId: string, actorId: string, id: string): Promise<EmailConfigView> {
  const row = await getRow(tenantId, id);
  await enforceHourlyLimit(tenantId, "domain.checked", DOMAIN_CHECKS_PER_HOUR, "domain checks");
  const preset = getProvider(row.provider);
  const result = await checkDomain(emailDomain(row.from_email), preset.spfInclude, row.dkim_selector ?? preset.dkimSelector);
  await recordOutcome(tenantId, row, { domain_check: result });
  await audit(tenantId, actorId, "domain.checked", id, { domain: result.domain, overall: result.overall });
  return getView(tenantId, id);
}

/** Whether passwords can be saved on this server (shown on the page so admins aren't surprised at Save). */
export function credentialEncryptionReady(): boolean {
  return credentialKeysFromEnv() !== null;
}
