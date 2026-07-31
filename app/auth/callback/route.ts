import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_NEXT = "/admin?from=login";

/** Only ever follow a same-site relative path — `next` arrives as a URL query param, so treat it as untrusted rather than passing it straight to redirect(). */
function safeNextPath(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  return raw;
}

/**
 * OAuth callback for Supabase Auth's Google sign-in (Sign In With
 * Google button in features/admin/auth/google-auth-button.tsx). Google
 * redirects back to Supabase's own hosted callback first (which
 * exchanges the code with Google and creates/updates the auth.users
 * row), and Supabase then redirects here with a PKCE `code` for this
 * app to exchange for an actual session cookie.
 *
 * `link_event_id`, when present, links a brand-new OAuth signup to the
 * event they were creating an account for — either a wizard draft
 * (features/start/account-form.tsx) or an owner-issued registration
 * link (features/admin/register/register-form.tsx). The password-signup
 * equivalent of this happens inside the handle_new_confirmed_admin DB
 * trigger via `raw_user_meta_data->>'draft_event_id'`, but
 * signInWithOAuth can't set that metadata the way signUp's `options.data`
 * can — Google's own profile fields populate raw_user_meta_data instead
 * — so this does the same linking as a one-time follow-up UPDATE here.
 * Guarded with `.is("event_id", null)` so it can only ever set this
 * once, never overwrite an existing link.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const linkEventId = url.searchParams.get("link_event_id");

  if (code) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user && linkEventId) {
      const { error: linkError } = await supabaseAdmin()
        .from("admins")
        .update({ event_id: linkEventId })
        .eq("id", data.user.id)
        .is("event_id", null);
      if (linkError) console.error("auth callback: failed to link event to new admin:", linkError.message);
    } else if (error) {
      console.error("auth callback: exchangeCodeForSession failed:", error.message);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
