"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/forms/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex items-center gap-1.5 text-sm text-ivory-100/70 hover:text-gold-300"
    >
      <LogOut size={15} /> Sign Out
    </button>
  );
}
