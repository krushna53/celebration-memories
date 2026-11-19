import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

import { SmtpSafeError } from "@/lib/mailer/email-config/smtp-errors";

/**
 * Encrypts SMTP passwords before they reach the database (AES-256-GCM).
 *
 * - The key comes from MAILER_CREDENTIAL_ENCRYPTION_KEY (32+ characters),
 *   which lives only in server env — never in the database, so a database
 *   export or backup holds ciphertext it can't open.
 * - Each ciphertext is bound (GCM additional data) to its company and
 *   configuration id, so copying one company's ciphertext onto another
 *   company's row makes it fail to decrypt instead of leaking.
 * - Key rotation: put the old key in MAILER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS
 *   and a new one in MAILER_CREDENTIAL_ENCRYPTION_KEY. Old ciphertexts still
 *   open, and are re-encrypted with the new key the next time they're used
 *   successfully (services/mailer-email-config/store.ts).
 */

const FORMAT = "v1";
const MIN_KEY_LENGTH = 32;

export interface CredentialKey {
  id: string;
  key: Buffer;
}

export interface CredentialKeys {
  current: CredentialKey;
  previous: CredentialKey[];
}

function deriveKey(secret: string): CredentialKey {
  const key = Buffer.from(hkdfSync("sha256", secret, "everymoment-mailer", "smtp-credential-v1", 32));
  return { id: createHash("sha256").update(key).digest("hex").slice(0, 12), key };
}

/** The configured keys, or null when encryption isn't set up (then passwords can't be saved). */
export function credentialKeysFromEnv(env: Record<string, string | undefined> = process.env): CredentialKeys | null {
  const current = env.MAILER_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!current || current.length < MIN_KEY_LENGTH) return null;
  const previous = (env.MAILER_CREDENTIAL_ENCRYPTION_KEY_PREVIOUS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_KEY_LENGTH)
    .map(deriveKey);
  return { current: deriveKey(current), previous };
}

export interface CredentialBinding {
  tenantId: string;
  configId: string;
}

function aad(binding: CredentialBinding): Buffer {
  return Buffer.from(`everymoment-mailer-smtp|${binding.tenantId}|${binding.configId}`, "utf8");
}

export function encryptCredential(plain: string, binding: CredentialBinding, keys: CredentialKeys): { ciphertext: string; keyId: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys.current.key, iv);
  cipher.setAAD(aad(binding));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: [FORMAT, keys.current.id, iv.toString("base64"), body.toString("base64"), tag.toString("base64")].join(":"),
    keyId: keys.current.id,
  };
}

const UNREADABLE = "The saved SMTP password can't be read (the server's encryption key changed). Enter the password again and save.";

export function decryptCredential(ciphertext: string, binding: CredentialBinding, keys: CredentialKeys): string {
  const [format, keyId, iv, body, tag] = ciphertext.split(":");
  if (format !== FORMAT || !keyId || !iv || !body || !tag) throw new SmtpSafeError("not_configured", UNREADABLE);
  const key = [keys.current, ...keys.previous].find((k) => k.id === keyId);
  if (!key) throw new SmtpSafeError("not_configured", UNREADABLE);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key.key, Buffer.from(iv, "base64"));
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new SmtpSafeError("not_configured", UNREADABLE);
  }
}

/** True when the ciphertext was made with an older key and should be re-encrypted. */
export function needsReencryption(ciphertext: string, keys: CredentialKeys): boolean {
  return ciphertext.split(":")[1] !== keys.current.id;
}
