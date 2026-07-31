"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Wizard-flavored sibling of app/admin/register/page.tsx — same
 * Supabase Auth signUp flow (an `admins` row is only created once the
 * host clicks the email verification link, via the
 * handle_new_confirmed_admin trigger), but passes `draft_event_id` in
 * the signup metadata so that trigger scopes the new admin to this
 * exact draft event (see the scope_new_admin_to_draft_event migration),
 * and redirects back into the wizard's payment step afterward instead
 * of straight to /admin/login.
 */
export function AccountForm({ token, eventId }: { token: string; eventId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        data: { name, draft_event_id: eventId },
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}${wizardStepHref(token, "payment")}?verified=1`
            : undefined,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? "An account with this email already exists — try signing in instead."
          : signUpError.message,
      );
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-navy-950/10 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
          <CheckCircle2 size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-navy-950">Check your email</h1>
        <p className="mt-2 text-sm text-navy-700/70">
          We&rsquo;ve sent a verification link to <strong className="text-navy-950">{email}</strong>.
          Click it, then come back here to finish setting up billing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-navy-950/10 bg-white p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
        <UserPlus size={22} />
      </div>
      <h1 className="mt-4 text-center font-display text-2xl text-navy-950">Create Your Account</h1>
      <p className="mt-1 text-center text-sm text-navy-700/60">
        This keeps what you&rsquo;ve built and unlocks your full dashboard.
      </p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 text-left">
        <div>
          <label htmlFor="name" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">
            Full Name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(inputClasses, "mt-1.5")}
          />
        </div>
        <div>
          <label htmlFor="email" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(inputClasses, "mt-1.5")}
          />
        </div>
        <div>
          <label htmlFor="password" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputClasses, "mt-1.5")}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={cn(inputClasses, "mt-1.5")}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading ? <Loader2 className="animate-spin" size={16} /> : "Create Account"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.15em] text-navy-700/40">
        <span className="h-px flex-1 bg-navy-950/10" /> or <span className="h-px flex-1 bg-navy-950/10" />
      </div>
      <GoogleAuthButton
        label="Continue with Google"
        redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(
          `${wizardStepHref(token, "payment")}?verified=1`,
        )}&link_event_id=${encodeURIComponent(eventId)}`}
      />

      <p className="mt-6 text-center text-sm text-navy-700/60">
        Already have an account?{" "}
        <Link href="/admin/login" className="text-gold-600 underline underline-offset-4 hover:text-gold-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
