"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-4 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

export default function AdminLoginPage() {
  const router = useRouter();
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
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
          <LockKeyhole size={22} />
        </div>
        <h1 className="mt-4 font-display text-2xl text-ivory-50">Admin Sign In</h1>
        <p className="mt-1 text-sm text-ivory-100/60">Celebration Memories dashboard</p>

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
      </div>
    </div>
  );
}
