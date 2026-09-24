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
  mobile: "flex min-h-12 w-full items-center py-3 text-base text-ivory-100/90 hover:text-gold-300 active:text-gold-300",
};

const LOGIN_PILL_CLASSES: Record<"desktop" | "mobile", string> = {
  desktop:
    "rounded-full border border-gold-400/40 px-4 py-1.5 text-sm tracking-wide text-gold-300 transition-luxury duration-300 hover:border-gold-400 hover:bg-gold-400/10",
  mobile:
    "flex min-h-12 w-full items-center justify-center rounded-full border border-gold-400/50 px-5 text-base font-medium text-gold-300 active:bg-gold-400/10",
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
      // Any failure here (flaky network in the installed app's WebView,
      // a stale session) must fall back to "signed out" — leaving email
      // as undefined would render nothing at all, i.e. no Login option.
      try {
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
      } catch {
        if (!cancelled) {
          setEmail((current) => current ?? null);
          setDashboardPath(null);
        }
      }
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

  if (variant === "mobile") {
    // Explicit, full-width rows on mobile — the bare "Hi {email}" text
    // alone gave no visible way into the dashboard from the app.
    return (
      <>
        <span className="truncate py-2 text-sm text-ivory-100/60" title={email}>
          Signed in as {email}
        </span>
        {dashboardPath ? (
          <Link href={dashboardPath} onClick={onNavigate} className={LOGIN_PILL_CLASSES.mobile}>
            Go to Dashboard
          </Link>
        ) : (
          <Link href="/login" onClick={onNavigate} className={LOGIN_PILL_CLASSES.mobile}>
            Login
          </Link>
        )}
        <button type="button" onClick={handleSignOut} className={cn(LINK_CLASSES.mobile, "gap-2")}>
          <LogOut size={16} /> Logout
        </button>
      </>
    );
  }

  // Desktop: a compact Dashboard pill + icon-only Logout. The full
  // "Hi {email}" greeting was the widest item in the header and pushed
  // it off the edge on laptop screens; the email is still one hover
  // away (title) and announced to screen readers.
  const initial = email.charAt(0).toUpperCase();

  return (
    <>
      {dashboardPath ? (
        <Link
          href={dashboardPath}
          onClick={onNavigate}
          title={`Signed in as ${email}`}
          aria-label={`Dashboard (signed in as ${email})`}
          className={cn(LOGIN_PILL_CLASSES.desktop, "flex items-center gap-2 whitespace-nowrap pl-1.5")}
        >
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-xs font-semibold text-navy-950">
            {initial}
          </span>
          Dashboard
        </Link>
      ) : (
        <span
          title={`Signed in as ${email}`}
          aria-label={`Signed in as ${email}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500 text-sm font-semibold text-navy-950"
        >
          {initial}
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        title="Logout"
        aria-label="Logout"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ivory-100/70 transition-luxury duration-300 hover:bg-white/10 hover:text-gold-300"
      >
        <LogOut size={16} />
      </button>
    </>
  );
}
