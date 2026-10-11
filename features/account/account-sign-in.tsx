"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SITE_URL } from "@/lib/constants";
import { GoogleAuthButton } from "@/features/admin/auth/google-auth-button";
export function AccountSignIn({next}:{next:string}) {
 const [email,setEmail]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 const callback=()=>`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
 return <div className="max-w-md space-y-5 rounded-xl border bg-white p-6"><h2 className="font-display text-xl">Sign in or create your account</h2><p className="text-sm">Your purchases and payment history will be saved to this account.</p>
 <GoogleAuthButton label="Continue with Google" redirectTo={typeof window!=="undefined"?callback():`${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`}/>
 <form className="space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const {error}=await supabaseBrowser().auth.signInWithOtp({email,options:{emailRedirectTo:callback()}});setMessage(error?error.message:"Check your email for a sign-in link, then return to billing.");}catch{setMessage("Could not send the link. Please try again.");}finally{setBusy(false);}}}>
 <label className="block">Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-lg border p-3"/></label><button disabled={busy} className="rounded-full bg-navy-950 px-5 py-3 text-white">{busy?"Sending…":"Email me a sign-in link"}</button></form><p role="status" className="text-sm">{message}</p></div>;
}
