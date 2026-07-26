"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Self-service signup for the event host (client role). Anyone can
 * reach this page and create a Supabase Auth account, but that alone
 * grants no dashboard access — a database trigger only creates their
 * `admins` row (role = 'client') once they click the verification link
 * in their email (see migration auto_admin_on_email_confirm). Until
 * then, /admin/login will just bounce them back here having created no
 * usable session.
 */
export default function AdminRegisterPage() {
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
        data: { name },
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/admin/login?verified=1` : undefined,
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
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
            <CheckCircle2 size={22} />
          </div>
          <h1 className="mt-4 font-display text-2xl text-ivory-50">Check your email</h1>
          <p className="mt-2 text-sm text-ivory-100/70">
            We&rsquo;ve sent a verification link to <strong className="text-ivory-50">{email}</strong>.
            Click it to activate your account, then come back and sign in.
          </p>
          <Link
            href="/admin/login"
            className="mt-6 inline-block text-sm text-gold-300 underline underline-offset-4 hover:text-gold-200"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <UserPlus size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-ivory-50">Host Registration</h1>
        <p className="mt-1 text-sm text-ivory-100/60">
          For the event host — create your account to manage Event Settings,
          Templates, Gallery, Timeline, and Memories.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4 text-left">
          <div>
            <label htmlFor="name" className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">
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
            <label htmlFor="email" className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">
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
            <label htmlFor="password" className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">
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
            <label
              htmlFor="confirmPassword"
              className="text-xs uppercase tracking-[0.15em] text-ivory-100/60"
            >
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
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
            {loading ? <Loader2 className="animate-spin" size={16} /> : "Create Account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-ivory-100/60">
          Already have an account?{" "}
          <Link href="/admin/login" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
