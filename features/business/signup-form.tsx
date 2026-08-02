"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Store } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { completeBusinessSignupAction } from "@/features/business/actions";
import { TermsConsentCheckbox } from "@/components/legal/terms-consent-checkbox";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Vendor self-signup — same supabaseBrowser().auth.signUp() call the
 * event-host register-form.tsx uses (same Supabase Auth project), but
 * creates a business_accounts row instead of an admins row, and isn't
 * gated behind an eventId. See services/business-auth.ts's
 * createBusinessAccount() doc comment for why this doesn't wait on
 * email confirmation.
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
      options: { data: { name }, emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/business/login?verified=1` : undefined },
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

    setSubmitted(true);
    setTimeout(() => router.push("/business/dashboard"), 1200);
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

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
        <Store size={22} />
      </div>
      <h1 className="mt-4 font-display text-2xl text-ivory-50">Become a Partner</h1>
      <p className="mt-1 text-sm text-ivory-100/60">
        Create your vendor account to list your business on Celebration Memories Discover.
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

      <p className="mt-6 text-sm text-ivory-100/60">
        Already listed?{" "}
        <Link href="/business/login" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          Sign in
        </Link>
      </p>
    </div>
  );
}
