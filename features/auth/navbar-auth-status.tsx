"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import { resolveLoginDestinationAction } from "@/features/auth/actions";

interface NavbarAuthStatusProps {
  /** Matches the surrounding <ul>'s spacing/layout — desktop is a single row, mobile is a stacked sheet. */
  variant: "desktop" | "mobile";
  /** Closes the mobile slide-down sheet on click/sign-out — no-op on desktop. */
  onNavigate?: () => void;
}

const LINK_CLASSES: Record<"desktop" | "mobile", string> = {
  desktop: "text-sm tracking-wide text-ivory-100/85 transition-luxury duration-300 hover:text-gold-300",
  mobile: "tap-target flex items-center text-sm text-ivory-100/85 hover:text-gold-300",
};

const LOGIN_PILL_CLASSES: Record<"desktop" | "mobile", string> = {
  desktop:
    "rounded-full border border-gold-400/40 px-4 py-1.5 text-sm tracking-wide text-gold-300 transition-luxury duration-300 hover:border-gold-400 hover:bg-gold-400/10",
  mobile: "tap-target flex items-center text-sm text-gold-300",
};

/**
 * Replaces the navbar's plain "Login" link with session-aware state —
 * "Hi {email}" (linking to whichever dashboard resolveLoginDestinationAction
 * picks for this account — admin, business, or forms, see that
 * function's doc comment) plus a "Logout" action, whenever someone is
 * actually signed in. Shows the original "Login" link otherwise.
 *
 * Client-side and session-driven (not passed down from a Server
 * Component) because the Navbar is a shared, mostly-static component
 * rendered on public marketing pages that have no per-request admin/
 * business/form-owner lookup of their own — re-plumbing a session prop
 * through every page that renders <Navbar showLogin> would be a much
 * bigger change for the same result. `onAuthStateChange` keeps this in
 * sync immediately after sign-in/sign-out without a full page reload.
 */
export function NavbarAuthStatus({ variant, onNavigate }: NavbarAuthStatusProps) {
  const router = useRouter();
  // undefined = still checking (render nothing, avoids a "Login" flash
  // for someone who's actually signed in), null = signed out.
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [dashboardPath, setDashboardPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabaseBrowser().auth.getUser();
      if (cancelled) return;
      setEmail(user?.email ?? null);

      if (!user) {
        setDashboardPath(null);
        return;
      }
      const destination = await resolveLoginDestinationAction();
      if (!cancelled) setDashboardPath(destination.kind === "none" ? null : destination.path);
    }

    load();
    const {
      data: { subscription },
    } = supabaseBrowser().auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabaseBrowser().auth.signOut();
    onNavigate?.();
    router.push("/");
    router.refresh();
  }

  if (email === undefined) return null;

  if (!email) {
    return (
      <Link href="/login" onClick={onNavigate} className={LOGIN_PILL_CLASSES[variant]}>
        Login
      </Link>
    );
  }

  const greeting = (
    <span className={cn(LINK_CLASSES[variant], "truncate", variant === "desktop" ? "max-w-[180px]" : "max-w-full")} title={email}>
      Hi {email}
    </span>
  );

  return (
    <>
      {dashboardPath ? (
        <Link href={dashboardPath} onClick={onNavigate} className="min-w-0">
          {greeting}
        </Link>
      ) : (
        greeting
      )}
      <button type="button" onClick={handleSignOut} className={cn(LINK_CLASSES[variant], "flex shrink-0 items-center gap-1.5")}>
        <LogOut size={14} /> Logout
      </button>
    </>
  );
}
