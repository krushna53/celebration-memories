import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Identity system for Marketplace vendors (photographers, venues,
 * artists, ...) — deliberately separate from services/admin-auth.ts's
 * owner/client system. An event host and a business owner are
 * unrelated concepts; forcing them through one `admins`/`AdminRole`
 * table would mean either giving every vendor implicit access to some
 * event's dashboard, or bolting a third role onto path-allowlist logic
 * that was designed around exactly two. Both Supabase Auth systems
 * share the same underlying `auth.users` table (Supabase's own), so
 * the same email can hold both an `admins` row and a `business_accounts`
 * row with no conflict — "become part of the ecosystem" from the
 * module spec.
 */

export interface CurrentBusinessAccount {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

/** Resolves the signed-in Supabase Auth user (if any) against the business_accounts table — mirrors getCurrentAdmin()'s shape exactly, just a different backing table. */
export async function getCurrentBusinessAccount(): Promise<CurrentBusinessAccount | null> {
  const session = await supabaseServer();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseAdmin()
    .from("business_accounts")
    .select("id, email, name, phone")
    .eq("id", user.id)
    .maybeSingle<CurrentBusinessAccount>();

  if (error) {
    console.error("Failed to check business_accounts:", error.message);
    return null;
  }
  return data;
}

export async function requireBusinessAccount(): Promise<CurrentBusinessAccount> {
  const account = await getCurrentBusinessAccount();
  if (!account) throw new Error("Please sign in to your business account.");
  return account;
}

/**
 * Creates the `business_accounts` row right after a successful
 * supabaseBrowser().auth.signUp() call — not gated on email
 * confirmation, unlike the admins table's handle_new_confirmed_admin
 * trigger, since a vendor building out their listing draft while their
 * confirmation email is still in-flight is normal, low-risk UX (the
 * listing itself needs a separate admin approval before going public
 * either way — see setListingStatus). Verifies the given userId is a
 * real, just-created auth user with a matching email before inserting,
 * so this can't be used to attach a business account to an arbitrary
 * user id.
 */
export async function createBusinessAccount(userId: string, email: string, name: string, phone?: string): Promise<void> {
  const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(userId);
  if (userError || !userData?.user || userData.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Could not verify your account. Please try signing up again.");
  }

  const { error } = await supabaseAdmin()
    .from("business_accounts")
    .upsert({ id: userId, email, name, phone: phone || null }, { onConflict: "id" });
  if (error) throw new Error(`Failed to create business account: ${error.message}`);
}

export async function updateBusinessAccount(accountId: string, input: { name?: string; phone?: string }): Promise<void> {
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = input.phone;
  const { error } = await supabaseAdmin().from("business_accounts").update(patch).eq("id", accountId);
  if (error) throw new Error(`Failed to update account: ${error.message}`);
}
