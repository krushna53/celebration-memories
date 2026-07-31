"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";

interface GoogleAuthButtonProps {
  label?: string;
  /**
   * Full absolute URL to /auth/callback, with `next` (where to land
   * after) and optionally `link_event_id` (see that route's doc
   * comment) already appended as query params by the caller.
   */
  redirectTo: string;
}

/**
 * "Continue with Google" — used on the wizard's account-creation step
 * (features/start/account-form.tsx), the owner-invited client
 * registration page (features/admin/register/register-form.tsx), and
 * the returning-user login page (app/admin/login/page.tsx). Requires
 * the Google provider to be enabled in the Supabase project's
 * Authentication > Providers settings with a real Google Cloud OAuth
 * Client ID/Secret — that one-time setup has to be done by a human in
 * the Supabase Dashboard, the same way creating the Stripe/Razorpay
 * accounts did.
 */
export function GoogleAuthButton({ label = "Continue with Google", redirectTo }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
    // On success the browser navigates away to Google's consent screen
    // immediately — no further local state update needed or possible.
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm font-medium text-navy-950 shadow-sm transition-luxury duration-200 hover:bg-ivory-100 disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
        {label}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
