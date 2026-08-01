"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/** Mirrors app/admin/login/page.tsx's sign-in flow exactly (same auth.signInWithPassword call, same friendly-error mapping), just a different landing route. */
export function BusinessLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email first — check your inbox for the verification link."
          : "Invalid email or password.",
      );
      return;
    }

    router.replace("/business/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
        <LogIn size={22} />
      </div>
      <h1 className="mt-4 font-display text-2xl text-ivory-50">Vendor Sign In</h1>
      <p className="mt-1 text-sm text-ivory-100/60">Manage your Celebration Memories Discover listing.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 text-left">
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClasses} mt-1.5`} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] text-ivory-100/60">Password</label>
          <input
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

      <p className="mt-6 text-sm text-ivory-100/60">
        New here?{" "}
        <Link href="/business/signup" className="text-gold-300 underline underline-offset-4 hover:text-gold-200">
          Become a Partner
        </Link>
      </p>
    </div>
  );
}
