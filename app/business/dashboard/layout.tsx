import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Store } from "lucide-react";

import { getCurrentBusinessAccount } from "@/services/business-auth";
import { businessSignOutAction } from "@/features/business/auth-actions";

export default async function BusinessDashboardLayout({ children }: { children: React.ReactNode }) {
  const account = await getCurrentBusinessAccount();
  if (!account) {
    redirect("/business/login");
  }

  return (
    <div className="min-h-screen bg-ivory-100">
      <header className="border-b border-navy-950/10 bg-navy-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/business/dashboard" className="flex items-center gap-2 font-display text-lg text-gold-300">
            <Store size={18} /> Vendor Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ivory-100/70 sm:inline">{account.name ?? account.email}</span>
            <form action={businessSignOutAction}>
              <button type="submit" className="tap-target flex items-center gap-1.5 text-sm text-ivory-100/70 hover:text-gold-300">
                <LogOut size={16} /> Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
