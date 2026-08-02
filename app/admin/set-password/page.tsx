"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Where a team-invite email (services/admin-team.ts's
 * inviteTeamMemberByEmail, via Supabase's auth.admin.inviteUserByEmail)
 * sends the invitee. Supabase's client SDK parses the invite/recovery
 * token out of the URL on load and establishes a session automatically
 * (createBrowserClient's default detectSessionInUrl behavior) — this
 * page just needs to confirm that happened, then let them set a
 * password via auth.updateUser(). Nothing else in the app previously
 * needed a "consume a Supabase invite link" page.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        setHasSession(!!data.session);
        setCheckingSession(false);
      });
  }, []);

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
    const { error: updateError } = await supabaseBrowser().auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/admin"), 1200);
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <Loader2 className="animate-spin text-gold-300" size={28} />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-navy-900 p-8 text-center shadow-xl">
          <h1 className="font-display text-xl text-ivory-50">Link no longer valid</h1>
          <p className="mt-2 text-sm text-ivory-100/70">
            This invite link has expired or was already used. Ask whoever invited you to send a fresh one.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
            <CheckCircle2 size={22} />
          </div>
          <h1 className="mt-4 font-display text-2xl text-ivory-50">You&rsquo;re all set</h1>
          <p className="mt-2 text-sm text-ivory-100/70">Taking you to the dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <KeyRound size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-ivory-50">Set your password</h1>
        <p className="mt-1 text-sm text-ivory-100/60">One more step and you&rsquo;ll have dashboard access.</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4 text-left">
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
              className={`${inputClasses} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? <Loader2 className="animate-spin" size={16} /> : "Set Password & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
