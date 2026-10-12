import "server-only";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Agency / host branding (table host_brands, migration
 * 20261012140000_host_brands.sql). One brand per host account — the
 * login that owns events (events.owner_user_id). An agency like CorpCrew
 * sets it once on /admin/branding and every event it owns shows
 * "Event powered by CorpCrew" with its logo, unless that event sets its
 * own co-brand (services/event-cobrand.ts).
 *
 * Every read degrades to null on any error, so pages never break if the
 * table is missing or a lookup fails.
 */
export interface HostBrand {
  displayName: string;
  websiteUrl: string | null;
  logoPath: string | null;
  logoUrl: string | null;
  applyToEvents: boolean;
}

interface HostBrandRow {
  display_name: string;
  website_url: string | null;
  logo_path: string | null;
  apply_to_events: boolean;
}

export const BRAND_NAME_MAX = 60;
export const BRAND_URL_MAX = 200;
export const BRAND_LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_BUCKET = "avatars";
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function logoUrl(path: string | null): string | null {
  if (!path) return null;
  return supabaseAdmin().storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function mapBrand(row: HostBrandRow): HostBrand {
  return {
    displayName: row.display_name,
    websiteUrl: row.website_url,
    logoPath: row.logo_path,
    logoUrl: logoUrl(row.logo_path),
    applyToEvents: row.apply_to_events,
  };
}

export async function getHostBrand(userId: string): Promise<HostBrand | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("host_brands")
      .select("display_name, website_url, logo_path, apply_to_events")
      .eq("user_id", userId)
      .maybeSingle<HostBrandRow>();
    if (error || !data) return null;
    return mapBrand(data);
  } catch {
    return null;
  }
}

/** The brand an event should show — its owner's, only when the owner has it switched on for their events. */
export async function getBrandForEvent(eventId: string): Promise<HostBrand | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("owner_user_id")
      .eq("id", eventId)
      .maybeSingle<{ owner_user_id: string | null }>();
    if (error || !data?.owner_user_id) return null;
    const brand = await getHostBrand(data.owner_user_id);
    return brand?.applyToEvents ? brand : null;
  } catch {
    return null;
  }
}

/** Trims and validates the text fields; returns the row patch or a message for the host. */
export function parseBrandInput(input: {
  displayName: string;
  websiteUrl: string;
  applyToEvents: boolean;
}): { ok: true; patch: Omit<HostBrandRow, "logo_path"> } | { ok: false; error: string } {
  const name = input.displayName.trim().replace(/\s+/g, " ");
  const url = input.websiteUrl.trim();
  if (!name) return { ok: false, error: "Add your agency or company name." };
  if (name.length > BRAND_NAME_MAX) return { ok: false, error: `Keep the name under ${BRAND_NAME_MAX} characters.` };
  if (url) {
    if (url.length > BRAND_URL_MAX) return { ok: false, error: "That link is too long." };
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: "Enter a full link starting with https://" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Enter a full link starting with https://" };
    }
  }
  return { ok: true, patch: { display_name: name, website_url: url || null, apply_to_events: input.applyToEvents } };
}

export async function saveHostBrand(userId: string, patch: Omit<HostBrandRow, "logo_path">): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("host_brands")
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function deleteHostBrand(userId: string): Promise<void> {
  const brand = await getHostBrand(userId);
  const { error } = await supabaseAdmin().from("host_brands").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (brand?.logoPath) await supabaseAdmin().storage.from(LOGO_BUCKET).remove([brand.logoPath]);
}

/** Signed upload URL for a new logo, always under brands/<userId>/. */
export async function createBrandLogoUpload(
  userId: string,
  contentType: string,
  fileSize: number,
): Promise<{ path: string; signedUrl: string }> {
  const ext = LOGO_TYPES[contentType];
  if (!ext) throw new Error("Use a PNG, JPG or WebP logo.");
  if (fileSize > BRAND_LOGO_MAX_BYTES) throw new Error("Logos can be up to 5MB.");
  const path = `brands/${userId}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from(LOGO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error("Couldn't start the upload — please try again.");
  return { path, signedUrl: data.signedUrl };
}

/** Points the brand at a freshly uploaded logo (or none) and deletes the old file. Requires the brand to exist. */
export async function setHostBrandLogo(userId: string, path: string | null): Promise<string | null> {
  if (path !== null && !path.startsWith(`brands/${userId}/`)) throw new Error("That upload doesn't belong to your account.");
  const brand = await getHostBrand(userId);
  if (!brand) throw new Error("Save your brand name first.");
  const { error } = await supabaseAdmin()
    .from("host_brands")
    .update({ logo_path: path, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (brand.logoPath && brand.logoPath !== path) {
    await supabaseAdmin().storage.from(LOGO_BUCKET).remove([brand.logoPath]);
  }
  return logoUrl(path);
}
