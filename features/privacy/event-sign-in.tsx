"use client";
import { useState } from "react";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";
import { supabaseBrowser } from "@/lib/supabase/client";
export function EventSignIn({ next, signedIn }: { next: string; signedIn: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const callback = typeof window === "undefined" ? "" : `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  return <div className="space-y-4">
    {signedIn ? <><p>This account is not on the approved guest list. Ask the host to invite your confirmed email, or sign in with another account.</p><button className="underline" onClick={async () => { await supabaseBrowser().auth.signOut(); window.location.reload(); }}>Use another account</button></> : <>
      <GoogleAuthButton redirectTo={callback} label="Continue with Google" />
      <details><summary className="cursor-pointer">Use email and password</summary><form className="mt-4 space-y-3" onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError(""); const form = new FormData(e.currentTarget);
        try { const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) }); if (error) setError("Sign-in failed. Check your email and password."); else window.location.assign(next); } catch { setError("Could not sign in. Please try again."); } finally { setBusy(false); }
      }}><label className="block">Email<input required type="email" name="email" autoComplete="email" className="block w-full rounded border p-2 text-navy-950" /></label><label className="block">Password<input required type="password" name="password" autoComplete="current-password" className="block w-full rounded border p-2 text-navy-950" /></label><button disabled={busy} className="rounded-full bg-gold-500 px-5 py-3 text-navy-950">{busy ? "Signing in…" : "Sign in"}</button></form></details>
    </>}{error && <p role="alert">{error}</p>}
  </div>;
}
