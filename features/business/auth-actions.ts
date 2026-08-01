"use server";

import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";

/** Mirrors features/admin/auth-actions.ts's signOutAction — same Supabase Auth session, different destination. */
export async function businessSignOutAction() {
  const session = await supabaseServer();
  await session.auth.signOut();
  redirect("/business/login");
}
