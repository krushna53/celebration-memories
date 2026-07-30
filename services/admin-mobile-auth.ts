import "server-only";
import { randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateInviteToken } from "@/lib/tokens";
import type { AdminRole, CurrentAdmin } from "@/services/admin-auth";

/**
 * Mobile companion-app auth. Deliberately NOT the same email/password as
 * the web admin login (Supabase Auth) — a phone-friendly "access code"
 * instead, same "possession of the value is the credential" pattern
 * already used for invitees.token (see lib/tokens.ts), rather than
 * reusing the account password on a second, lower-friction surface. An
 * admin generates/regenerates this from the web dashboard (see
 * features/admin/mobile-access) and types it once into the app; the app
 * then holds a long-lived session token (this file, admin_mobile_sessions)
 * instead of re-typing the code every launch.
 */

interface AdminRow {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  event_id: string | null;
}

function toCurrentAdmin(row: AdminRow): CurrentAdmin {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    hasSeenTour: true, // the mobile app has its own onboarding; this field is a web-dashboard concept.
    eventId: row.event_id,
  };
}

/** 192 bits of entropy — this token alone grants a signed-in admin session, so it needs far more entropy than the human-typed access code below. Never displayed to a person, only stored on-device. */
function generateSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Returns this admin's current mobile access code, generating one on
 * first call. Retries on the unlikely event of a collision (mobile_access_code
 * is UNIQUE).
 */
export async function getOrCreateMobileAccessCode(adminId: string): Promise<string> {
  const client = supabaseAdmin();

  const { data: existing, error: fetchError } = await client
    .from("admins")
    .select("mobile_access_code")
    .eq("id", adminId)
    .maybeSingle<{ mobile_access_code: string | null }>();

  if (fetchError) throw new Error(`Failed to look up mobile access code: ${fetchError.message}`);
  if (existing?.mobile_access_code) return existing.mobile_access_code;

  return regenerateMobileAccessCode(adminId);
}

/**
 * Issues a brand-new code, replacing any existing one, and signs out
 * every phone currently using the old code (deletes this admin's
 * admin_mobile_sessions rows) — the same "rotate the credential, kill
 * existing sessions" behavior you'd want from a password reset.
 */
export async function regenerateMobileAccessCode(adminId: string): Promise<string> {
  const client = supabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteToken(10); // 10 chars from lib/tokens.ts's readable alphabet — a bit more entropy than a guest invite token, since this grants admin access.
    const { error } = await client
      .from("admins")
      .update({ mobile_access_code: code, mobile_access_code_created_at: new Date().toISOString() })
      .eq("id", adminId);

    if (!error) {
      await client.from("admin_mobile_sessions").delete().eq("admin_id", adminId);
      return code;
    }
    // Unique-violation on mobile_access_code — extremely unlikely at this alphabet/length, but retry rather than surface a confusing error.
    if (!error.message.includes("duplicate key")) {
      throw new Error(`Failed to generate mobile access code: ${error.message}`);
    }
  }

  throw new Error("Could not generate a unique mobile access code — please try again.");
}

export type MobileLoginResult =
  | { success: true; sessionToken: string; admin: CurrentAdmin }
  | { success: false; error: string };

/** Step 1 of mobile sign-in: exchange a human-typed access code for a long-lived session token. */
export async function loginWithMobileAccessCode(code: string): Promise<MobileLoginResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { success: false, error: "Please enter your access code." };
  }

  const client = supabaseAdmin();
  const { data, error } = await client
    .from("admins")
    .select("id, email, name, role, event_id")
    .eq("mobile_access_code", trimmed)
    .maybeSingle<AdminRow>();

  if (error) {
    return { success: false, error: "Something went wrong. Please try again." };
  }
  if (!data) {
    return { success: false, error: "That access code wasn't recognized. Check with whoever set up your event." };
  }

  const sessionToken = generateSessionToken();
  const { error: insertError } = await client
    .from("admin_mobile_sessions")
    .insert({ token: sessionToken, admin_id: data.id });

  if (insertError) {
    return { success: false, error: "Could not start a session. Please try again." };
  }

  return { success: true, sessionToken, admin: toCurrentAdmin(data) };
}

/** Resolves a mobile session token (the app's `Authorization: Bearer <token>` header) back to an admin, bumping last_used_at. Returns null for a missing/invalid/revoked token. */
export async function getAdminByMobileSessionToken(token: string): Promise<CurrentAdmin | null> {
  if (!token) return null;
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("admin_mobile_sessions")
    .select("admin_id, admins(id, email, name, role, event_id)")
    .eq("token", token)
    .maybeSingle<{ admin_id: string; admins: AdminRow | null }>();

  if (error || !data?.admins) return null;

  void client
    .from("admin_mobile_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {});

  return toCurrentAdmin(data.admins);
}

/** Extracts and resolves the bearer token from a mobile API route's Authorization header. Throws so callers can short-circuit with a 401 the same way requireOwner/requireAdminForEvent do for the web. */
export async function requireMobileAdmin(authorizationHeader: string | null): Promise<CurrentAdmin> {
  const token = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : null;
  if (!token) throw new Error("Not authorized.");

  const admin = await getAdminByMobileSessionToken(token);
  if (!admin) throw new Error("Your session has expired. Please sign in again.");
  return admin;
}
