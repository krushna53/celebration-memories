import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely —
 * this is intentional (see supabase/README.md): guests are identified by
 * their invite token, not a Supabase Auth session, so all guest-facing
 * reads/writes happen server-side through this client instead of relying
 * on RLS + the anon key.
 *
 * The `server-only` import makes it a build error to accidentally import
 * this module from a Client Component.
 */
function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cached: SupabaseClient | null = null;

/** Lazily-created, memoised service-role client for server-side use only. */
export function supabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = getAdminClient();
  }
  return cached;
}
