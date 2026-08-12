"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";
import { TermsConsentCheckbox } from "@/components/legal/terms-consent-checkbox";
import { reportAccountCreationErrorAction } from "@/features/start/actions/account-lead";

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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Best-effort "someone reached Create Account but didn't make it
  // through" lead capture (task: notify Krushna Web Works by email when
  // this happens) — see services/wizard-leads.ts for the shared logic.
  // `latestRef` sidesteps stale-closure issues in the pagehide/unmount
  // handlers below, which are registered once on mount but need to read
  // whatever was last typed. `reportedRef` guarantees at most one report
  // per visit, whichever path fires first (an explicit signUp() error,
  // or leaving the page without ever submitting).
  const latestRef = useRef({ name, email, phone, submitted });
  const reportedRef = useRef(false);
  useEffect(() => {
    latestRef.current = { name, email, phone, submitted };
  });

  useEffect(() => {
    function reportAbandonment() {
      if (reportedRef.current) return;
      const latest = latestRef.current;
      if (latest.submitted) return;
      if (!latest.email.trim() && !latest.phone.trim()) return;

      reportedRef.current = true;
      const payload = JSON.stringify({
        eventId,
        name: latest.name.trim() || null,
        email: latest.email.trim() || null,
        phone: latest.phone.trim() || null,
      });

      // navigator.sendBeacon is the one browser API designed to survive
      // the page actually unloading (tab close/reload) — a fetch call,
      // even with keepalive, isn't guaranteed to complete once the JS
      // context starts tearing down. Falls back to fetch for the
      // SPA-navigates-away case (component unmounts, but the page
      // itself is still alive) or if sendBeacon isn't available.
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/wizard/account-lead", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/wizard/account-lead", { method: "POST", body: payload, keepalive: true }).catch(() => {});
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") reportAbandonment();
    }

    window.addEventListener("pagehide", reportAbandonment);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", reportAbandonment);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Client-side navigation away from this step (e.g. clicking a wizard
      // "back" link) unmounts this component without a real page unload —
      // same report, same one-shot guard.
      reportAbandonment();
    };
  }, [eventId]);

  // Shared with the "Resend confirmation email" action below — must be
  // byte-identical to the redirect used on the original signUp() call,
  // or a resent link would drop the host somewhere other than back into
  // this same wizard draft's payment step.
  function verificationRedirectTo() {
    return typeof window !== "undefined"
      ? `${window.location.origin}${wizardStepHref(token, "payment")}?verified=1`
      : undefined;
  }

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
        emailRedirectTo: verificationRedirectTo(),
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.toLowerCase().includes("already registered")
          ? "An account with this email already exists — try signing in instead."
          : signUpError.message,
      );
      // Reported regardless of which error this was — "already
      // registered" is still someone Krushna Web Works may want to
      // follow up with (maybe they forgot they had an account). Marks
      // reportedRef so the pagehide/unmount abandonment check below
      // doesn't also fire a second, redundant notification for the same
      // visit.
      reportedRef.current = true;
      void reportAccountCreationErrorAction({
        eventId,
        name: name.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        errorMessage: signUpError.message,
      });
      return;
    }

    setSubmitted(true);
    setResendCooldown(30);
  }

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    const { error: resendError } = await supabaseBrowser().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: verificationRedirectTo() },
    });
    setResending(false);
    setResendCooldown(30);
    setResendMessage(
      resendError ? resendError.message : "Sent again — check your inbox (and spam folder).",
    );
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
        <p className="mt-4 text-xs text-navy-700/50">
          Didn&rsquo;t get it?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            className="text-gold-600 underline underline-offset-4 hover:text-gold-500 disabled:cursor-not-allowed disabled:text-navy-700/40 disabled:no-underline"
          >
            {resending
              ? "Sending…"
              : resendCooldown > 0
                ? `Resend confirmation email (${resendCooldown}s)`
                : "Resend confirmation email"}
          </button>
        </p>
        {resendMessage ? <p className="mt-2 text-xs text-navy-700/60">{resendMessage}</p> : null}
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
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <div>
          <label htmlFor="phone" className="text-xs uppercase tracking-[0.15em] text-navy-700/60">
            Mobile Number <span className="normal-case text-navy-700/40">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="For support follow-up if something goes wrong"
            className={cn(inputClasses, "mt-1.5")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <TermsConsentCheckbox checked={agreedToTerms} onChange={setAgreedToTerms} variant="light" />

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={loading || !agreedToTerms} className="mt-2 w-full">
          {loading ? <Loader2 className="animate-spin" size={16} /> : "Create Account"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.15em] text-navy-700/40">
        <span className="h-px flex-1 bg-navy-950/10" /> or <span className="h-px flex-1 bg-navy-950/10" />
      </div>
      {/*
        Clicking through to Google navigates the browser away, which
        would otherwise trip the pagehide listener above and misreport a
        legitimate in-progress signup as an abandoned one. onClickCapture
        runs synchronously before GoogleAuthButton's own onClick starts
        the (async, then-redirecting) signInWithOAuth call, so the guard
        is set before the page ever unloads.
      */}
      <div onClickCapture={() => { reportedRef.current = true; }}>
        <GoogleAuthButton
          label="Continue with Google"
          disabled={!agreedToTerms}
          redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(
            `${wizardStepHref(token, "payment")}?verified=1`,
          )}&link_event_id=${encodeURIComponent(eventId)}`}
        />
      </div>

      <p className="mt-6 text-center text-sm text-navy-700/60">
        Already have an account?{" "}
        <Link href="/admin/login" className="text-gold-600 underline underline-offset-4 hover:text-gold-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
