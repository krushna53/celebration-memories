import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CurrentAdmin {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Resolves the signed-in Supabase Auth user (if any) and checks them
 * against the `admins` allowlist table. Being a valid Supabase Auth user
 * is not sufficient on its own — only rows present in `admins` may reach
 * the dashboard, so provisioning a new admin is a deliberate two-step
 * process (create the auth user, then add them to `admins`).
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await supabaseServer();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabaseAdmin()
    .from("admins")
    .select("id, email, name")
    .eq("id", user.id)
    .maybeSingle<{ id: string; email: string; name: string | null }>();

  if (error) {
    console.error("Failed to check admins allowlist:", error.message);
    return null;
  }

  return data;
}
