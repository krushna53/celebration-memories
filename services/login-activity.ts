import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

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

/** Session-authenticated RPC: the database independently requires the platform owner. */
export async function listLoginActivity(): Promise<LoginActivityRow[]> {
  const client = await supabaseServer();
  const rows: LoginActivityRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.rpc("list_login_activity", { page_offset: offset, page_size: PAGE_SIZE });
    if (error) throw new Error(`Failed to load login activity: ${error.message}`);
    const page = (data ?? []) as {
      id: string; email: string | null; name: string | null; kinds: LoginAccountKind[];
      admin_role: string | null; created_at: string; last_sign_in_at: string | null;
    }[];
    rows.push(...page.map((row) => ({
      id: row.id, email: row.email ?? "(no email)", name: row.name,
      kinds: row.kinds, adminRole: row.admin_role,
      createdAt: row.created_at, lastSignInAt: row.last_sign_in_at,
    })));
    if (page.length < PAGE_SIZE) return rows;
  }
}
