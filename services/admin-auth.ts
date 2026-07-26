import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminRole = "owner" | "client";

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  /** Whether this admin has already dismissed/finished the interactive dashboard tour once. See features/admin/tour/. */
  hasSeenTour: boolean;
}

/**
 * Resolves the signed-in Supabase Auth user (if any) and checks them
 * against the `admins` allowlist table. Being a valid Supabase Auth user
 * is not sufficient on its own — only rows present in `admins` may reach
 * the dashboard, so provisioning a new admin is a deliberate two-step
 * process (create the auth user, then add them to `admins`).
 *
 * `role` gates which parts of the dashboard an admin can see:
 * - "owner" (Krushna Web Works) — everything.
 * - "client" (the event host) — event content only: Overview, Event
 *   Settings, Templates, Gallery, Timeline, Memories. See
 *   lib/admin-roles.ts for the exact allow-list and how to change it.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await supabaseServer();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("id, email, name, role, has_seen_tour")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      email: string;
      name: string | null;
      role: AdminRole;
      has_seen_tour: boolean;
    }>();

  if (error) {
    console.error("Failed to check admins allowlist:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    hasSeenTour: data.has_seen_tour,
  };
}

/**
 * For Server Actions that are owner-only (Invitees, Referrals,
 * Inquiries, Check-In). Throws rather than returning a boolean so
 * callers can't accidentally ignore the result — every owner-only
 * action must call this before doing anything.
 */
export async function requireOwner(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (admin.role !== "owner") throw new Error("This action is restricted to the site owner.");
  return admin;
}

