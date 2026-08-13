"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getCurrentBusinessAccount } from "@/services/business-auth";
import { getCurrentFormOwner } from "@/services/custom-forms";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Backing logic for the unified login page (app/login/page.tsx,
 * features/auth/unified-login-form.tsx) — this app has three separate
 * account tables sharing one Supabase Auth project (admins,
 * business_accounts, form_owners), each with its own dashboard. A
 * single email can, in principle, have a row in more than one of
 * them, so after a successful sign-in we resolve *where to send them*
 * by a fixed priority — admin (the broadest access level) first,
 * then business, then forms (the narrowest) — rather than showing a
 * "which dashboard?" picker. This mirrors the reasoning already used
 * for role precedence elsewhere in the app (e.g. an owner-role admin
 * always outranks client/organizer).
 */
export type LoginDestination =
  | { kind: "admin"; path: string }
  | { kind: "business"; path: string }
  | { kind: "forms"; path: string }
  | { kind: "none" };

export async function resolveLoginDestinationAction(): Promise<LoginDestination> {
  const admin = await getCurrentAdmin();
  if (admin) return { kind: "admin", path: "/admin?from=login" };

  const business = await getCurrentBusinessAccount();
  if (business) return { kind: "business", path: "/business/dashboard" };

  const formOwner = await getCurrentFormOwner();
  if (formOwner) return { kind: "forms", path: "/forms/dashboard" };

  return { kind: "none" };
}

/**
 * Read-only check for "is anyone signed in at all under this shared
 * Supabase Auth project" — regardless of whether they have a row in
 * any of the three product tables (admins/business_accounts/
 * form_owners). getCurrentAdmin()/getCurrentBusinessAccount()/
 * getCurrentFormOwner() all collapse "no session" and "session, but no
 * row in my table" into the same `null` — usually fine, but a couple
 * of places need to tell those two apart: most notably the wizard's
 * account step (app/start/[token]/account/page.tsx), which offers to
 * add a client role to an already-signed-in Marketplace vendor or
 * Build RSVP / Form account instead of running them through
 * AccountForm's signUp() (which fails as "already registered" — same
 * email, same shared Auth project).
 */
export async function getCurrentSupabaseUser(): Promise<{ id: string; email: string | null; name: string | null } | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata as { full_name?: string; name?: string } | null;
  return { id: user.id, email: user.email ?? null, name: meta?.full_name ?? meta?.name ?? null };
}
