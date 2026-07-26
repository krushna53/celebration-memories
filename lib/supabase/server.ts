import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Session-aware Supabase client for Server Components/Actions — reads
 * the admin's Supabase Auth session from cookies. Uses the anon key
 * (not the service-role key): this client is subject to RLS and is only
 * ever used to answer "who is currently signed in", never to read
 * guest data directly.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — middleware is
            // responsible for refreshing the session cookie in that case.
          }
        },
      },
    },
  );
}
