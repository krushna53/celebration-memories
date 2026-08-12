"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getCurrentBusinessAccount } from "@/services/business-auth";
import { getCurrentFormOwner } from "@/services/custom-forms";

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
