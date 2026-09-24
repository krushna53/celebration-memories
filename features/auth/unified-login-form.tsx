"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";
import { EmailAuthDisclosure } from "@/features/auth/email-auth-disclosure";
import { resolveLoginDestinationAction } from "@/features/auth/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * One shared sign-in form for all three of this app's account types —
 * admin (event hosts + Krushna Web Works), business (marketplace
 * vendors), and forms (Custom Form Builder owners). Replaces what used
 * to be three near-identical copies (app/admin/login,
 * app/business/login, app/forms/login) — those routes now just
 * redirect here (see each page.tsx), so old links/bookmarks keep
 * working.
 *
 * After a successful sign-in (password or Google), routing is decided
 * server-side by features/auth/actions.ts's resolveLoginDestinationAction —
 * admin first, then business, then forms (see that file's doc comment
 * for why no "which dashboard?" picker is shown). The same resolution
 * also runs once on mount, so landing here already signed in (e.g. the
 * Google OAuth round-trip through /auth/callback?next=/login, or simply
 * revisiting /login while a session is still active) redirects
 * immediately instead of showing the form pointlessly.
 */
export function UnifiedLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justVerified = searchParams.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabaseBrowser().auth.getSession();
      if (cancelled || !session) return;
      setRedirecting(true);
      await goToDestination();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToDestination() {
    const destination = await resolveLoginDestinationAction();
    if (destination.kind === "none") {
      setRedirecting(false);
      setError("This account isn't set up on EveryMoment yet — see the links below to get started.");
      return;
    }
    router.replace(destination.path);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(
        signInError.message.toLowerCase().includes("email not confirmed")
          ? "Please verify your email first — check your inbox for the link we sent."
          : "Invalid email or password.",
      );
      return;
    }

    await goToDestination();
    setLoading(false);
  }

  if (redirecting) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <Loader2 className="animate-spin text-gold-300" size={22} />
        <p className="text-sm text-ivory-100/70">Signing you in...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
        <LogIn size={22} />
      </div>
      <h1 className="mt-4 font-display text-2xl text-ivory-50">Sign In</h1>
      <p className="mt-1 text-sm text-ivory-100/60">One login for your EveryMoment dashboard.</p>

      {justVerified ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-300">
          <CheckCircle2 size={14} /> Email verified — you can sign in now.
        </p>
      ) : null}

      <div className="mt-6">
        <GoogleAuthButton
          label="Sign in with Google"
          redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent("/login")}`}
        />
      </div>
      <EmailAuthDisclosure variant="dark" defaultOpen={justVerified}>
        <form onSubmit={onSubmit} className="grid gap-4 text-left">
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
              className={`${inputClasses} mt-1.5`}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClasses} mt-1.5`}
            />
          </div>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : "Sign In"}
          </button>
        </form>
      </EmailAuthDisclosure>

      <p className="mt-6 text-sm text-ivory-100/60">
        New here?{" "}
        <Link href="/start" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          Build your event site
        </Link>
        {", "}
        <Link href="/forms/new" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          build a form
        </Link>
        {", or "}
        <Link href="/business/signup" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          become a partner
        </Link>{" "}
        — no account needed to start.
      </p>
    </div>
  );
}
