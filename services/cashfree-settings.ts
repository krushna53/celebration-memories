import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

function key() {
  const secret = process.env.CASHFREE_CREDENTIAL_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Credential encryption is not configured.");
  return createHash("sha256").update("everymoment:cashfree:v1:" + secret).digest();
}
function encrypt(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  return [iv, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()].map(b => b.toString("base64")).join(".");
}
function decrypt(value: string) {
  const [iv, body, tail, tag] = value.split(".").map(v => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv!);
  cipher.setAuthTag(tag!);
  return Buffer.concat([cipher.update(body!), cipher.update(tail!), cipher.final()]).toString("utf8");
}
export async function cashfreeSettings() {
  const { data, error } = await supabaseAdmin().from("cashfree_credentials").select("app_id,secret_ciphertext,environment").eq("id", true).maybeSingle();
  if (error) throw new Error("Cashfree settings are unavailable. Check that the database migration is installed.");
  return data ? { appId: data.app_id as string, secretKey: decrypt(data.secret_ciphertext), environment: data.environment as "sandbox" | "production" } : {
    appId: process.env.CASHFREE_APP_ID || "", secretKey: process.env.CASHFREE_SECRET_KEY || "", environment: (process.env.CASHFREE_ENVIRONMENT || "sandbox") as "sandbox" | "production",
  };
}
export async function saveCashfreeSettings(appId: string, secret: string, environment: "sandbox" | "production", actor: string) {
  const previous = await cashfreeSettings();
  if (previous.environment !== environment && !secret) throw new Error("Enter the matching secret when changing environments.");
  if (!appId || !(secret || previous.secretKey)) throw new Error("App ID and Secret Key are required.");
  const { error } = await supabaseAdmin().from("cashfree_credentials").upsert({ id: true, app_id: appId, secret_ciphertext: encrypt(secret || previous.secretKey), environment, updated_by: actor, updated_at: new Date().toISOString() });
  if (error) throw new Error("Could not save Cashfree credentials.");
}
