import "server-only";

import type { DomainCheck, EmailConfigView } from "@/types/mailer-email-config";

/**
 * Where Email Configuration data lives. store.ts holds all the rules
 * (validation, tenant checks, encryption, verification); a backend only
 * reads and writes rows, always scoped to one tenant.
 *
 *   MAILER_EMAIL_CONFIG_STORE=supabase   (default) — the migration's tables
 *   MAILER_EMAIL_CONFIG_STORE=firestore  — a Firebase project (FIREBASE_* env)
 *
 * Only Email Configuration uses this; nothing else in the app moves.
 */

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigError";
  }
}

export interface ConfigRow {
  id: string;
  tenant_user_id: string;
  label: string;
  provider: EmailConfigView["provider"];
  sender_name: string;
  from_email: string;
  reply_to_email: string | null;
  reply_to_name: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_encryption: EmailConfigView["encryption"];
  smtp_username: string | null;
  auth_enabled: boolean;
  is_default: boolean;
  sending_enabled: boolean;
  dkim_selector: string | null;
  connection_status: EmailConfigView["connectionStatus"];
  connection_checked_at: string | null;
  connection_error: string | null;
  verified_at: string | null;
  domain_check: DomainCheck | null;
  updated_at: string;
}

export interface SecretMeta {
  config_id: string;
  updated_at: string;
}

export interface AuditEntry {
  tenant_user_id: string;
  actor_user_id: string;
  action: string;
  config_id: string | null;
  details: Record<string, unknown>;
}

export type ConfigPatch = Record<string, unknown>;

export interface EmailConfigBackend {
  readonly name: "supabase" | "firestore";
  getConfig(tenantId: string, id: string): Promise<ConfigRow | null>;
  /** Default first, then oldest first. */
  listConfigs(tenantId: string): Promise<ConfigRow[]>;
  countConfigs(tenantId: string): Promise<number>;
  insertConfig(tenantId: string, id: string, values: ConfigPatch): Promise<void>;
  /** With ifUpdatedAt, the update is skipped when the row changed since it was read. */
  updateConfig(tenantId: string, id: string, patch: ConfigPatch, options?: { ifUpdatedAt?: string }): Promise<void>;
  clearDefaultExcept(tenantId: string, keepId: string): Promise<void>;
  /** Deletes the configuration and its stored password. */
  deleteConfig(tenantId: string, id: string): Promise<void>;
  oldestConfigId(tenantId: string): Promise<string | null>;

  secretMeta(tenantId: string, ids: string[]): Promise<Map<string, SecretMeta>>;
  getSecretCiphertext(tenantId: string, id: string): Promise<string | null>;
  putSecret(tenantId: string, id: string, ciphertext: string, keyId: string, updatedAt: string): Promise<void>;
  deleteSecret(tenantId: string, id: string): Promise<void>;

  /** Never throws — a lost audit row mustn't break the action. */
  insertAudit(entry: AuditEntry): Promise<void>;
  countAuditSince(tenantId: string, action: string, sinceIso: string): Promise<number>;
}

export type BackendName = EmailConfigBackend["name"];

export function configuredBackendName(env: NodeJS.ProcessEnv = process.env): BackendName {
  return (env.MAILER_EMAIL_CONFIG_STORE ?? "").trim().toLowerCase() === "firestore" ? "firestore" : "supabase";
}
