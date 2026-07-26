"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client, scoped to the anon key only (never the
 * service-role key). Used exclusively for uploading a file straight to
 * Storage via a short-lived signed upload URL minted server-side —
 * everything else in this app goes through Server Actions.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
