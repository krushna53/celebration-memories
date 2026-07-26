"use server";

import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";

export async function signOutAction() {
  const session = await supabaseServer();
  await session.auth.signOut();
  redirect("/admin/login");
}
