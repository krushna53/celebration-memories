import "server-only";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { LOGO_MAX_BYTES } from "@/lib/mailer/brand";
import { MailerError } from "@/features/mailer/repository/types";

/**
 * Live-mode Brand Settings logo files. The Mailer's data lives in Firestore,
 * but an email needs a logo it can load from a public https URL (mail apps
 * block inline images), so the PNG goes to the existing public `avatars`
 * Storage bucket — the same one /admin/branding logos use — always under
 * mailer-brands/<tenantId>/. Only the URL is stored in the Mailer data.
 */

const BUCKET = "avatars";

function folderFor(tenantId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(tenantId)) throw new MailerError("That request isn't valid.");
  return `mailer-brands/${tenantId}/`;
}

function publicUrlOf(path: string): string {
  return supabaseAdmin().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** A one-time link the browser PUTs the converted PNG to, plus where it can be loaded from afterwards. */
export async function createMailerLogoUpload(tenantId: string, size: unknown): Promise<{ signedUrl: string; publicUrl: string }> {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) throw new MailerError("That logo couldn't be read — try another image.");
  if (size > LOGO_MAX_BYTES) throw new MailerError("Logos can be up to 2 MB.");
  const path = `${folderFor(tenantId)}${randomUUID()}.png`;
  try {
    const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("no signed url");
    return { signedUrl: data.signedUrl, publicUrl: publicUrlOf(path) };
  } catch {
    throw new MailerError("Couldn't start the logo upload — please try again.");
  }
}

/** The Storage path of `url` when it's one of this company's own logo uploads, else null. */
export function ownLogoPath(tenantId: string, url: string | null | undefined): string | null {
  if (!url) return null;
  const folder = folderFor(tenantId);
  const prefix = publicUrlOf(folder);
  if (!url.startsWith(prefix)) return null;
  const name = url.slice(prefix.length);
  return /^[0-9a-f-]{36}\.png$/.test(name) ? `${folder}${name}` : null;
}

/** Best effort: a leftover file is harmless, so failures are only logged. */
export async function removeMailerLogo(path: string): Promise<void> {
  try {
    await supabaseAdmin().storage.from(BUCKET).remove([path]);
  } catch {
    console.warn("[mailer] couldn't remove an old brand logo");
  }
}
