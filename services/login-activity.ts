import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type LoginAccountKind = "admin" | "business" | "forms";

export interface LoginActivityRow {
  id: string;
  email: string;
  name: string | null;
  /** Which product tables this login has a row in — one Auth user can be several (e.g. an admin who also has a vendor listing). Empty = signed up but never finished onboarding. */
  kinds: LoginAccountKind[];
  /** Admin role, when `kinds` includes "admin". */
  adminRole: string | null;
  createdAt: string;
  /** Supabase Auth's own `last_sign_in_at` — set on every real sign-in (password, magic link, OAuth), not on silent session refreshes. Null = never signed in (e.g. an invite they never accepted). */
  lastSignInAt: string | null;
}

const PAGE_SIZE = 1000;

/**
 * Every Supabase Auth login on the platform with its last sign-in time,
 * most recent first. Powers the owner-only /admin/logins page. Reads
 * auth.users through the Admin API (service role) — never exposed to a
 * client admin, since it spans every account on the platform.
 */
export async function listLoginActivity(): Promise<LoginActivityRow[]> {
  const client = supabaseAdmin();

  const users: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; user_metadata?: Record<string, unknown> }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`Failed to list logins: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < PAGE_SIZE) break;
  }

  const [admins, businesses, formOwners] = await Promise.all([
    client.from("admins").select("id, name, role"),
    client.from("business_accounts").select("id, name"),
    client.from("form_owners").select("id, name"),
  ]);
  if (admins.error) throw new Error(`Failed to load admins: ${admins.error.message}`);

  const adminById = new Map(((admins.data ?? []) as { id: string; name: string | null; role: string }[]).map((a) => [a.id, a]));
  const businessById = new Map(((businesses.data ?? []) as { id: string; name: string | null }[]).map((b) => [b.id, b]));
  const formOwnerById = new Map(((formOwners.data ?? []) as { id: string; name: string | null }[]).map((f) => [f.id, f]));

  const rows = users.map<LoginActivityRow>((user) => {
    const admin = adminById.get(user.id);
    const business = businessById.get(user.id);
    const formOwner = formOwnerById.get(user.id);
    const kinds: LoginAccountKind[] = [];
    if (admin) kinds.push("admin");
    if (business) kinds.push("business");
    if (formOwner) kinds.push("forms");
    const metaName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    return {
      id: user.id,
      email: user.email ?? "(no email)",
      name: admin?.name ?? business?.name ?? formOwner?.name ?? (typeof metaName === "string" ? metaName : null),
      kinds,
      adminRole: admin?.role ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
    };
  });

  // Most recent sign-in first; never-signed-in accounts last, newest first among them.
  return rows.sort((a, b) => {
    if (a.lastSignInAt && b.lastSignInAt) return b.lastSignInAt.localeCompare(a.lastSignInAt);
    if (a.lastSignInAt) return -1;
    if (b.lastSignInAt) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
