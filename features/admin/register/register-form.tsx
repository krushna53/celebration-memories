"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

interface RegisterFormProps {
  /** Which event this login should be linked to — null means "no event specified" (see the page component's doc comment for why that's now a hard stop, not a silent fallback). */
  eventId: string | null;
  /** honoreeName from the target event, for display only — null if eventId is null or the event couldn't be found. */
  eventLabel: string | null;
  /** True if an `?event=` param was given but didn't resolve to a real event — shown as an error instead of the form. */
  invalidEvent: boolean;
}

/**
 * Self-service signup for an event host (client role). A database
 * trigger (handle_new_confirmed_admin) creates the actual `admins` row
 * once the person verifies their email, reading the event id straight
 * out of `raw_user_meta_data->>'draft_event_id'` — set below from the
 * `eventId` prop, which the page component resolved from `?event=`.
 *
 * This link is meant to be generated per-client from /admin/events
 * ("Create Login" on a specific event's row) — see
 * features/admin/events/event-list.tsx. It deliberately refuses to
 * proceed without a valid `eventId`: see app/admin/register/page.tsx
 * for why an unscoped signup used to be a real security bug.
 */
export function RegisterForm({ eventId, eventLabel, invalidEvent }: RegisterFormProps) {
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

  if (invalidEvent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-navy-900 p-8 text-center shadow-xl">
          <h1 className="font-display text-xl text-ivory-50">Link no longer valid</h1>
          <p className="mt-2 text-sm text-ivory-100/70">
            This registration link doesn&rsquo;t match a live event. Ask the site owner for a
            fresh link from their All Events page.
          </p>
        </div>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
          <h1 className="font-display text-xl text-ivory-50">A link is required</h1>
          <p className="mt-2 text-sm text-ivory-100/70">
            Host accounts are created from a specific invitation link. Ask the site owner to
            generate one for your event from their All Events page (each row has a
            &ldquo;Create Login&rdquo; link).
          </p>
        </div>
      </div>
    );
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
          {eventLabel
            ? `Create your login to manage ${eventLabel}'s event — Event Settings, Templates, Gallery, Timeline, and Memories.`
            : "Create your account to manage Event Settings, Templates, Gallery, Timeline, and Memories."}
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
