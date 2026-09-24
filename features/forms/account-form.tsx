"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { createFormOwnerAccountAction } from "@/features/forms/builder-actions";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";
import { EmailAuthDisclosure } from "@/features/auth/email-auth-disclosure";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Shown to the form builder after they publish — the one point in this
 * whole flow where an account becomes worthwhile (to see responses in
 * a dashboard). Same supabaseBrowser().auth.signUp() call as
 * features/business/signup-form.tsx, then a Server Action creates the
 * form_owners row AND claims this specific form (see
 * createFormOwnerAccountAction) in one step. Skipping this is always
 * fine — the builder link (draft_token) keeps working either way.
 *
 * This Supabase project has email confirmation ON (see the "Confirm
 * signup" template), so signUp() never returns an active session —
 * only after the person clicks the link in their confirmation email
 * can they actually sign in. Earlier this claimed "You're in" and
 * auto-redirected to /forms/dashboard, which just bounced back to
 * /forms/login since there was no session yet. Now matches the
 * already-correct pattern used for admin/host signup
 * (features/admin/register/register-form.tsx's "Check your email... then
 * come back and sign in" + the shared /login page's `?verified=1`
 * banner, see features/auth/unified-login-form.tsx) instead of
 * promising something that can't happen yet. `emailRedirectTo` below
 * points the confirmation link at /login?verified=1 for that banner.
 */
export function FormOwnerAccountForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        data: { name },
        // Routes through /auth/callback (not straight to /login) so the
        // confirmation link's PKCE `code` actually gets exchanged for a
        // session server-side — see that route's doc comment. Pointing
        // emailRedirectTo directly at /login left the code unexchanged
        // and unhandled, and since /login is a newer path not yet in
        // Supabase's allow-listed Redirect URLs, it silently fell back
        // to the Site URL instead (reported: landed on the bare
        // homepage with an unused ?code=... and no "verified" message).
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?verified=1")}`
            : undefined,
      },
    });

    if (signUpError || !data.user) {
      setLoading(false);
      setError(
        signUpError?.message.toLowerCase().includes("already registered")
          ? "An account with this email already exists — try signing in instead."
          : (signUpError?.message ?? "Something went wrong."),
      );
      return;
    }

    const result = await createFormOwnerAccountAction(token, data.user.id, email, name);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-5 text-center">
        <CheckCircle2 className="mx-auto text-gold-600" size={24} />
        <p className="mt-2 text-sm font-medium text-navy-950">Check your email</p>
        <p className="mt-1 text-xs text-navy-700/60">
          We&rsquo;ve sent a verification link to <strong className="text-navy-950">{email}</strong>. Click it to
          activate your account, then come back and sign in.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-xs font-medium text-gold-700 underline underline-offset-4 hover:text-gold-800"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-navy-950/10 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-navy-950">
        <UserPlus size={16} className="text-gold-600" /> Create an account to view responses
      </div>
      <p className="text-xs text-navy-700/60">
        Your form works either way — this just gives you a dashboard to search, export, and manage responses later.
      </p>
      {/*
        Google skips email confirmation entirely — /auth/callback's
        form_token branch creates the form_owners row, claims this form,
        and lands them straight on their responses dashboard.
      */}
      <GoogleAuthButton
        label="Continue with Google"
        redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(
          "/forms/dashboard",
        )}&form_token=${encodeURIComponent(token)}`}
      />
      <EmailAuthDisclosure variant="light">
        <form onSubmit={onSubmit} className="grid gap-3">
          <input
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClasses}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
          />
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : "Create Account"}
          </button>
        </form>
      </EmailAuthDisclosure>
    </div>
  );
}
