import "server-only";
import { randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateInviteToken } from "@/lib/tokens";
import type { CurrentBusinessAccount } from "@/services/business-auth";

/**
 * Mobile companion-app auth for Marketplace vendors — exactly mirrors
 * services/admin-mobile-auth.ts's pattern (phone-friendly access code,
 * exchanged once for a long-lived opaque session token) rather than
 * reusing the web vendor's Supabase Auth email/password, for the same
 * reasons: no token-refresh handling needed client-side, and instantly
 * revocable by regenerating the code from the dashboard. See
 * features/business/mobile-access for where a vendor generates this.
 */

interface BusinessAccountRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

function toCurrentBusinessAccount(row: BusinessAccountRow): CurrentBusinessAccount {
  return { id: row.id, email: row.email, name: row.name, phone: row.phone };
}

/** 192 bits of entropy — never displayed to a person, only stored on-device. */
function generateSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Returns this vendor's current mobile access code, generating one on first call. */
export async function getOrCreateBusinessMobileAccessCode(accountId: string): Promise<string> {
  const client = supabaseAdmin();

  const { data: existing, error: fetchError } = await client
    .from("business_accounts")
    .select("mobile_access_code")
    .eq("id", accountId)
    .maybeSingle<{ mobile_access_code: string | null }>();

  if (fetchError) throw new Error(`Failed to look up mobile access code: ${fetchError.message}`);
  if (existing?.mobile_access_code) return existing.mobile_access_code;

  return regenerateBusinessMobileAccessCode(accountId);
}

/** Issues a brand-new code, replacing any existing one, and signs out every phone currently using the old one. */
export async function regenerateBusinessMobileAccessCode(accountId: string): Promise<string> {
  const client = supabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteToken(10);
    const { error } = await client
      .from("business_accounts")
      .update({ mobile_access_code: code, mobile_access_code_created_at: new Date().toISOString() })
      .eq("id", accountId);

    if (!error) {
      await client.from("business_mobile_sessions").delete().eq("business_account_id", accountId);
      return code;
    }
    if (!error.message.includes("duplicate key")) {
      throw new Error(`Failed to generate mobile access code: ${error.message}`);
    }
  }

  throw new Error("Could not generate a unique mobile access code — please try again.");
}

export type BusinessMobileLoginResult =
  | { success: true; sessionToken: string; account: CurrentBusinessAccount }
  | { success: false; error: string };

/** Step 1 of mobile sign-in: exchange a human-typed access code for a long-lived session token. */
export async function loginWithBusinessMobileAccessCode(code: string): Promise<BusinessMobileLoginResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { success: false, error: "Please enter your access code." };
  }

  const client = supabaseAdmin();
  const { data, error } = await client
    .from("business_accounts")
    .select("id, email, name, phone")
    .eq("mobile_access_code", trimmed)
    .maybeSingle<BusinessAccountRow>();

  if (error) {
    return { success: false, error: "Something went wrong. Please try again." };
  }
  if (!data) {
    return { success: false, error: "That access code wasn't recognized. Check your listing dashboard on the website." };
  }

  const sessionToken = generateSessionToken();
  const { error: insertError } = await client
    .from("business_mobile_sessions")
    .insert({ token: sessionToken, business_account_id: data.id });

  if (insertError) {
    return { success: false, error: "Could not start a session. Please try again." };
  }

  return { success: true, sessionToken, account: toCurrentBusinessAccount(data) };
}

/** Resolves a mobile session token back to a business account, bumping last_used_at. Returns null for a missing/invalid/revoked token. */
export async function getBusinessAccountByMobileSessionToken(token: string): Promise<CurrentBusinessAccount | null> {
  if (!token) return null;
  const client = supabaseAdmin();

  const { data, error } = await client
    .from("business_mobile_sessions")
    .select("business_account_id, business_accounts(id, email, name, phone)")
    .eq("token", token)
    .maybeSingle<{ business_account_id: string; business_accounts: BusinessAccountRow | null }>();

  if (error || !data?.business_accounts) return null;

  void client
    .from("business_mobile_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {});

  return toCurrentBusinessAccount(data.business_accounts);
}

/** Extracts and resolves the bearer token from a mobile API route's Authorization header. Throws so callers can short-circuit with a 401. */
export async function requireMobileBusinessAccount(authorizationHeader: string | null): Promise<CurrentBusinessAccount> {
  const token = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : null;
  if (!token) throw new Error("Not authorized.");

  const account = await getBusinessAccountByMobileSessionToken(token);
  if (!account) throw new Error("Your session has expired. Please sign in again.");
  return account;
}
