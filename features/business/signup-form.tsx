"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Store } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { completeBusinessSignupAction } from "@/features/business/actions";
import { TermsConsentCheckbox } from "@/components/legal/terms-consent-checkbox";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Vendor self-signup — same supabaseBrowser().auth.signUp() call the
 * event-host register-form.tsx uses (same Supabase Auth project), but
 * creates a business_accounts row instead of an admins row, and isn't
 * gated behind an eventId. See services/business-auth.ts's
 * createBusinessAccount() doc comment for why the *row* isn't gated on
 * email confirmation — it's created right away regardless.
 *
 * The *redirect*, however, is gated on whether signUp() actually
 * returned a session: this Supabase project has email confirmation
 * ON, so signUp() normally does NOT return an active session, and
 * /business/dashboard requires one (services/business-auth.ts's
 * getCurrentBusinessAccount() reads the cookie-based session). This
 * used to unconditionally show "You're in!" and redirect after 1.2s
 * regardless, which just bounced back to /login with no session —
 * same bug already fixed for form-owner signup, see
 * features/forms/account-form.tsx's doc comment. Now checks
 * data.session: if present (confirmation is off, or this address was
 * already verified), go straight in as before; if not, show the same
 * honest "Check your email" card used everywhere else in the app.
 */
export function BusinessSignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreedToTerms) {
      setError("Please agree to the Terms and Conditions to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login?verified=1` : undefined },
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

    const result = await completeBusinessSignupAction(data.user.id, { name, email, phone });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (data.session) {
      setSubmitted(true);
      setTimeout(() => router.push("/business/dashboard"), 1200);
    } else {
      setAwaitingVerification(true);
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <CheckCircle2 size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-ivory-50">You&rsquo;re in!</h1>
        <p className="mt-2 text-sm text-ivory-100/70">Taking you to your dashboard...</p>
      </div>
    );
  }

  if (awaitingVerification) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <CheckCircle2 size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-ivory-50">Check your email</h1>
        <p className="mt-2 text-sm text-ivory-100/70">
          We&rsquo;ve sent a verification link to <strong className="text-ivory-50">{email}</strong>. Click it to
          activate your account, then come back and sign in — your listing draft will be waiting.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-gold-300 underline underline-offset-4 hover:text-gold-200"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
        <Store size={22} />
      </div>
      <h1 className="mt-4 font-display text-2xl text-ivory-50">Become a Partner</h1>
      <p className="mt-1 text-sm text-ivory-100/60">
        Create your vendor account to list your business on EveryMoment Discover.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 text-left">
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">Your Name / Business Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={`${inputClasses} mt-1.5`} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClasses} mt-1.5`} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClasses} mt-1.5`} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClasses} mt-1.5`}
          />
        </div>

        <TermsConsentCheckbox checked={agreedToTerms} onChange={setAgreedToTerms} variant="dark" />

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !agreedToTerms}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : "Create Vendor Account"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.15em] text-ivory-100/40">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>
      {/* business=1 tells /auth/callback to provision a business_accounts
          row from the Google profile if one doesn't exist yet — see that
          route's doc comment. Gated on the same Terms checkbox as the
          password path above, per GoogleAuthButton's disabled prop doc. */}
      <GoogleAuthButton
        label="Continue with Google"
        disabled={!agreedToTerms}
        redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent("/business/dashboard")}&business=1`}
      />

      <p className="mt-6 text-sm text-ivory-100/60">
        Already listed?{" "}
        <Link href="/login" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          Sign in
        </Link>
      </p>
    </div>
  );
}
