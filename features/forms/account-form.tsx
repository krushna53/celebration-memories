"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { createFormOwnerAccountAction } from "@/features/forms/builder-actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/**
 * Shown to the form builder after they publish — the one point in this
 * whole flow where an account becomes worthwhile (to see responses in
 * a dashboard). Same supabaseBrowser().auth.signUp() call as
 * features/business/signup-form.tsx, then a Server Action creates the
 * form_owners row AND claims this specific form (see
 * createFormOwnerAccountAction) in one step. Skipping this is always
 * fine — the builder link (draft_token) keeps working either way.
 */
export function FormOwnerAccountForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    setLoading(true);
    const { data, error: signUpError } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: { data: { name } },
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

    const result = await createFormOwnerAccountAction(token, data.user.id, email, name);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSubmitted(true);
    setTimeout(() => router.push("/forms/dashboard"), 1000);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 p-5 text-center">
        <CheckCircle2 className="mx-auto text-gold-600" size={24} />
        <p className="mt-2 text-sm text-navy-950">You&rsquo;re in — taking you to your dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border border-navy-950/10 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-navy-950">
        <UserPlus size={16} className="text-gold-600" /> Create an account to view responses
      </div>
      <p className="text-xs text-navy-700/60">
        Your form works either way — this just gives you a dashboard to search, export, and manage responses later.
      </p>
      <input required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
      <input
        required
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClasses}
      />
      <input
        required
        type="password"
        minLength={8}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClasses}
      />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110 disabled:opacity-60"
      >
        {loading ? <Loader2 className="animate-spin" size={16} /> : "Create Account"}
      </button>
    </form>
  );
}
