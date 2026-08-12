"use server";

import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";

/** Mirrors features/admin/auth-actions.ts's signOutAction — same Supabase Auth session, same shared /login destination now that all three account types (admin/business/forms) share one sign-in page. */
export async function businessSignOutAction() {
  const session = await supabaseServer();
  await session.auth.signOut();
  redirect("/login");
}
