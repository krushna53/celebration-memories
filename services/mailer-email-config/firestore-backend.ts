import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { EmailConfigError, type ConfigRow, type EmailConfigBackend, type SecretMeta } from "@/services/mailer-email-config/backend";
import { isSafeFirestoreId, mailerFirestore, MailerFirestoreSetupError, mailerTenantDoc } from "@/services/mailer-firestore";

/**
 * Email Configuration in Cloud Firestore, used when
 * MAILER_EMAIL_CONFIG_STORE=firestore (connection: services/mailer-firestore.ts).
 *
 * Layout — each company's data sits under its own document, so a tenant id
 * is part of every path:
 *   mailerTenants/{tenantId}/emailConfigs/{configId}
 *   mailerTenants/{tenantId}/emailConfigSecrets/{configId}   (encrypted password)
 *   mailerTenants/{tenantId}/emailAuditLogs/{autoId}
 *
 * Queries use single-field filters only, so no composite indexes are needed.
 */

function firestore(): Firestore {
  try {
    return mailerFirestore();
  } catch (err) {
    if (err instanceof MailerFirestoreSetupError) throw new EmailConfigError(err.message);
    throw err;
  }
}

function tenantDoc(tenantId: string) {
  // Ids become path segments; refuse anything that could point somewhere else.
  if (!isSafeFirestoreId(tenantId)) throw new EmailConfigError("Please sign in again.");
  firestore();
  return mailerTenantDoc(tenantId);
}

function configs(tenantId: string) {
  return tenantDoc(tenantId).collection("emailConfigs");
}
function secrets(tenantId: string) {
  return tenantDoc(tenantId).collection("emailConfigSecrets");
}
function auditLogs(tenantId: string) {
  return tenantDoc(tenantId).collection("emailAuditLogs");
}
function configId(id: string): string {
  if (!isSafeFirestoreId(id)) throw new EmailConfigError("That email configuration doesn't exist.");
  return id;
}

/** Turns Firestore failures into our own short messages (the raw error stays in the server log, without details). */
async function guard<T>(action: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof EmailConfigError) throw err;
    const code = (err as { code?: unknown }).code;
    console.error(`[mailer-email-config] firestore: ${action} failed`, { code });
    throw new EmailConfigError(`Couldn't ${action}. Please try again.`);
  }
}

type StoredConfig = ConfigRow & { created_at?: string };

function toRow(id: string, data: FirebaseFirestore.DocumentData | undefined): StoredConfig | null {
  if (!data) return null;
  return { ...(data as StoredConfig), id };
}

function byDefaultThenOldest(a: StoredConfig, b: StoredConfig): number {
  if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}

async function allConfigs(tenantId: string): Promise<StoredConfig[]> {
  const snap = await configs(tenantId).get();
  return snap.docs.map((d) => toRow(d.id, d.data())!).sort(byDefaultThenOldest);
}

export const firestoreBackend: EmailConfigBackend = {
  name: "firestore",

  getConfig: (tenantId, id) =>
    guard("load the email configuration", async () => {
      const snap = await configs(tenantId).doc(configId(id)).get();
      return toRow(snap.id, snap.data());
    }),

  listConfigs: (tenantId) => guard("load email configurations", () => allConfigs(tenantId)),

  countConfigs: (tenantId) =>
    guard("save the email configuration", async () => (await configs(tenantId).count().get()).data().count),

  insertConfig: (tenantId, id, values) =>
    guard("save the email configuration", async () => {
      // create() fails if the id is already taken, so an insert can never overwrite.
      await configs(tenantId)
        .doc(configId(id))
        .create({ ...values, id, tenant_user_id: tenantId, created_at: new Date().toISOString() });
    }),

  updateConfig: (tenantId, id, patch, options) =>
    guard("save the email configuration", async () => {
      const ref = configs(tenantId).doc(configId(id));
      if (!options?.ifUpdatedAt) {
        await ref.update(patch);
        return;
      }
      const expected = options.ifUpdatedAt;
      await firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && snap.get("updated_at") === expected) tx.update(ref, patch);
      });
    }),

  clearDefaultExcept: (tenantId, keepId) =>
    guard("save the email configuration", async () => {
      const snap = await configs(tenantId).where("is_default", "==", true).get();
      const batch = firestore().batch();
      for (const doc of snap.docs) if (doc.id !== keepId) batch.update(doc.ref, { is_default: false });
      await batch.commit();
    }),

  deleteConfig: (tenantId, id) =>
    guard("delete the email configuration", async () => {
      const batch = firestore().batch();
      batch.delete(configs(tenantId).doc(configId(id)));
      batch.delete(secrets(tenantId).doc(id));
      await batch.commit();
    }),

  oldestConfigId: (tenantId) =>
    guard("delete the email configuration", async () => {
      const rows = (await allConfigs(tenantId)).sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
      return rows[0]?.id ?? null;
    }),

  secretMeta: (tenantId, ids) =>
    guard("load the email configuration", async () => {
      if (ids.length === 0) return new Map<string, SecretMeta>();
      const refs = ids.map((id) => secrets(tenantId).doc(configId(id)));
      // Field mask: only the timestamp is read here, never the ciphertext.
      const snaps = await firestore().getAll(...refs, { fieldMask: ["updated_at"] });
      const out = new Map<string, SecretMeta>();
      for (const s of snaps) if (s.exists) out.set(s.id, { config_id: s.id, updated_at: String(s.get("updated_at") ?? "") });
      return out;
    }),

  getSecretCiphertext: (tenantId, id) =>
    guard("load the email configuration", async () => {
      const snap = await secrets(tenantId).doc(configId(id)).get();
      const value = snap.get("password_ciphertext");
      return typeof value === "string" ? value : null;
    }),

  putSecret: (tenantId, id, ciphertext, keyId, updatedAt) =>
    guard("save the password", async () => {
      await secrets(tenantId)
        .doc(configId(id))
        .set({ config_id: id, tenant_user_id: tenantId, password_ciphertext: ciphertext, key_id: keyId, updated_at: updatedAt });
    }),

  deleteSecret: (tenantId, id) =>
    guard("save the email configuration", async () => {
      await secrets(tenantId).doc(configId(id)).delete();
    }),

  async insertAudit(entry) {
    try {
      await auditLogs(entry.tenant_user_id).add({ ...entry, created_at: new Date().toISOString() });
    } catch (err) {
      console.error("[mailer-email-config] firestore: audit write failed", { code: (err as { code?: unknown }).code, action: entry.action });
    }
  },

  countAuditSince: (tenantId, action, sinceIso) =>
    guard("check the hourly limit", async () => {
      // One range filter (no composite index); the action is matched here.
      const snap = await auditLogs(tenantId).where("created_at", ">=", sinceIso).select("action").get();
      return snap.docs.filter((d) => d.get("action") === action).length;
    }),
};
