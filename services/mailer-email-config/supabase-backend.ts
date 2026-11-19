import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { EmailConfigError, type ConfigRow, type EmailConfigBackend, type SecretMeta } from "@/services/mailer-email-config/backend";

/** Email Configuration in Supabase (migration 20261117120000_mailer_email_configs.sql). */

const SETUP_MESSAGE =
  "Email Configuration isn't set up in the database yet. Apply the migration supabase/migrations/20261117120000_mailer_email_configs.sql first.";

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /mailer_email_/.test(error.message ?? "");
}

function dbError(error: { code?: string; message?: string } | null, action: string): never {
  if (isMissingTable(error)) throw new EmailConfigError(SETUP_MESSAGE);
  // The database message isn't shown to the admin; the code is enough for our logs.
  console.error(`[mailer-email-config] ${action} failed`, { code: error?.code });
  throw new EmailConfigError(`Couldn't ${action}. Please try again.`);
}

const CONFIG_COLUMNS =
  "id, tenant_user_id, label, provider, sender_name, from_email, reply_to_email, reply_to_name, smtp_host, smtp_port, smtp_encryption, smtp_username, auth_enabled, is_default, sending_enabled, dkim_selector, connection_status, connection_checked_at, connection_error, verified_at, domain_check, updated_at";

export const supabaseBackend: EmailConfigBackend = {
  name: "supabase",

  async getConfig(tenantId, id) {
    const { data, error } = await supabaseAdmin()
      .from("mailer_email_configs")
      .select(CONFIG_COLUMNS)
      .eq("tenant_user_id", tenantId)
      .eq("id", id)
      .maybeSingle<ConfigRow>();
    if (error) dbError(error, "load the email configuration");
    return data ?? null;
  },

  async listConfigs(tenantId) {
    const { data, error } = await supabaseAdmin()
      .from("mailer_email_configs")
      .select(CONFIG_COLUMNS)
      .eq("tenant_user_id", tenantId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) dbError(error, "load email configurations");
    return (data ?? []) as ConfigRow[];
  },

  async countConfigs(tenantId) {
    const { count, error } = await supabaseAdmin()
      .from("mailer_email_configs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_user_id", tenantId);
    if (error) dbError(error, "save the email configuration");
    return count ?? 0;
  },

  async insertConfig(tenantId, id, values) {
    const { error } = await supabaseAdmin()
      .from("mailer_email_configs")
      .insert({ ...values, id, tenant_user_id: tenantId });
    if (error) dbError(error, "save the email configuration");
  },

  async updateConfig(tenantId, id, patch, options) {
    let query = supabaseAdmin().from("mailer_email_configs").update(patch).eq("tenant_user_id", tenantId).eq("id", id);
    if (options?.ifUpdatedAt) query = query.eq("updated_at", options.ifUpdatedAt);
    const { error } = await query;
    if (error) dbError(error, "save the email configuration");
  },

  async clearDefaultExcept(tenantId, keepId) {
    const { error } = await supabaseAdmin()
      .from("mailer_email_configs")
      .update({ is_default: false })
      .eq("tenant_user_id", tenantId)
      .neq("id", keepId);
    if (error) dbError(error, "save the email configuration");
  },

  async deleteConfig(tenantId, id) {
    // The secret row goes with it (ON DELETE CASCADE).
    const { error } = await supabaseAdmin().from("mailer_email_configs").delete().eq("tenant_user_id", tenantId).eq("id", id);
    if (error) dbError(error, "delete the email configuration");
  },

  async oldestConfigId(tenantId) {
    const { data } = await supabaseAdmin().from("mailer_email_configs").select("id").eq("tenant_user_id", tenantId).order("created_at").limit(1);
    return (data as { id: string }[] | null)?.[0]?.id ?? null;
  },

  async secretMeta(tenantId, ids) {
    if (ids.length === 0) return new Map();
    // Metadata only — the ciphertext column is deliberately not selected here.
    const { data, error } = await supabaseAdmin()
      .from("mailer_email_config_secrets")
      .select("config_id, updated_at")
      .eq("tenant_user_id", tenantId)
      .in("config_id", ids);
    if (error) dbError(error, "load the email configuration");
    return new Map(((data ?? []) as SecretMeta[]).map((s) => [s.config_id, s]));
  },

  async getSecretCiphertext(tenantId, id) {
    const { data, error } = await supabaseAdmin()
      .from("mailer_email_config_secrets")
      .select("password_ciphertext")
      .eq("tenant_user_id", tenantId)
      .eq("config_id", id)
      .maybeSingle<{ password_ciphertext: string }>();
    if (error) dbError(error, "load the email configuration");
    return data?.password_ciphertext ?? null;
  },

  async putSecret(tenantId, id, ciphertext, keyId, updatedAt) {
    const { error } = await supabaseAdmin()
      .from("mailer_email_config_secrets")
      .upsert({ config_id: id, tenant_user_id: tenantId, password_ciphertext: ciphertext, key_id: keyId, updated_at: updatedAt });
    if (error) dbError(error, "save the password");
  },

  async deleteSecret(tenantId, id) {
    const { error } = await supabaseAdmin().from("mailer_email_config_secrets").delete().eq("tenant_user_id", tenantId).eq("config_id", id);
    if (error) dbError(error, "save the email configuration");
  },

  async insertAudit(entry) {
    const { error } = await supabaseAdmin().from("mailer_email_audit_logs").insert(entry);
    if (error) console.error("[mailer-email-config] audit write failed", { code: error.code, action: entry.action });
  },

  async countAuditSince(tenantId, action, sinceIso) {
    const { count, error } = await supabaseAdmin()
      .from("mailer_email_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_user_id", tenantId)
      .eq("action", action)
      .gte("created_at", sinceIso);
    if (error) dbError(error, "check the hourly limit");
    return count ?? 0;
  },
};
