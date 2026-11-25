import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { signupRoleOf, type SignupRole } from "@/lib/signup-role";

/**
 * Applies the sign-up "Role" (lib/signup-role.ts) to an account.
 *
 * A Business Owner needs an `admins` row (role 'client', no event yet) to
 * open the Event Mailer at /admin/mailer — the same allowlist every
 * dashboard login goes through. It's created here, once; an existing row
 * (an event host, or the platform owner) is never changed.
 */

interface AuthUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Saves `role` on the user when they don't have one yet (Google sign-up
 * can't send it with the account the way email sign-up does), and returns
 * the role that applies.
 */
export async function rememberSignupRole(user: AuthUserLike, role: SignupRole | null): Promise<SignupRole | null> {
  const existing = signupRoleOf(user.user_metadata);
  if (existing || !role) return existing;
  const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata ?? {}), signup_role: role },
  });
  if (error) console.error("signup role: couldn't save the role on the user:", error.message);
  return role;
}

/** The signed-in user's sign-up role, read from their session. */
export async function currentSignupRole(): Promise<SignupRole | null> {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? signupRoleOf(user.user_metadata) : null;
  } catch {
    return null;
  }
}

/** Gives a Business Owner their admins row if they don't have one. Never throws — login must not break on it. */
export async function ensureBusinessOwnerAccess(user: AuthUserLike): Promise<boolean> {
  try {
    const { data: existing, error: lookupError } = await supabaseAdmin().from("admins").select("id").eq("id", user.id).maybeSingle<{ id: string }>();
    if (lookupError) return false;
    if (existing) return true;
    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
    const email = user.email ?? "";
    const { error } = await supabaseAdmin()
      .from("admins")
      .insert({ id: user.id, email, name: meta.full_name ?? meta.name ?? email ?? "Business Owner", role: "client" });
    if (error) {
      console.error("signup role: couldn't create the Business Owner account:", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
