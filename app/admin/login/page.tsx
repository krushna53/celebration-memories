"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justVerified = searchParams.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("email not confirmed")
          ? "Please verify your email first — check your inbox for the link we sent."
          : "Invalid email or password.",
      );
      setLoading(false);
      return;
    }

    // Signed in to Supabase Auth successfully, but that alone doesn't
    // grant dashboard access — the (dashboard) layout will bounce back
    // here if there's no matching `admins` row (e.g. email not yet
    // verified, so the auto-admin trigger hasn't fired).
    //
    // The ?from=login marker lets the Overview page (app/admin/(dashboard)/page.tsx)
    // send client-role admins on to the simplified /admin/simple view
    // ONLY right after signing in, without turning /admin itself into a
    // permanent redirect — the "Overview" nav link and /admin/simple's
    // own "Full Dashboard" link both point at plain /admin and need to
    // keep working normally.
    router.replace("/admin?from=login");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
        <LockKeyhole size={22} />
      </div>
      <h1 className="mt-4 font-display text-2xl text-ivory-50">Admin Sign In</h1>
      <p className="mt-1 text-sm text-ivory-100/60">Celebration Memories dashboard</p>

      {justVerified ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-300">
          <CheckCircle2 size={14} /> Email verified — you can sign in now.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 text-left">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputClasses, "mt-1.5")}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading ? <Loader2 className="animate-spin" size={16} /> : "Sign In"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ivory-100/60">
        New here?{" "}
        <Link href="/start" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          Build your event site
        </Link>{" "}
        — no account needed to start.
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
