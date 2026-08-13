"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { ACTIVE_EVENT, NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NavbarAuthStatus } from "@/features/auth/navbar-auth-status";

/**
 * Sticky, translucent site navigation. Collapses into a slide-down sheet
 * on mobile. Purely presentational — all anchors point at in-page
 * sections that later phases will populate.
 */
interface NavLink {
  label: string;
  href: string;
}

interface NavbarProps {
  honoreeName?: string;
  /** Overrides the default in-page anchor links (#hero, #details, ...) — used by non-event pages like the platform homepage, whose sections don't match those anchor ids. */
  navLinks?: readonly NavLink[];
  /**
   * Shows sign-in state, e.g. on the platform homepage — a "Login" link
   * pointing at /login (the shared admin/business/forms sign-in page)
   * when signed out, or "Hi {email}" + Logout when a session already
   * exists (see features/auth/navbar-auth-status.tsx). Event pages
   * leave this off since a guest has no reason to see it.
   */
  showLogin?: boolean;
  /**
   * Start transparent (with light text) and only pick up the dark,
   * blurred background once the page scrolls — looks great, but only
   * actually readable when there's a dark hero section directly behind
   * the nav at scroll position 0. Defaults to false (always the dark,
   * legible background) since most pages using this Navbar (RSVP,
   * Memories, the invite page, the events directory, the marketing
   * pages) open on a plain light background, not a hero — that mismatch
   * used to make the nav links nearly invisible on all of them. Only the
   * event homepage templates (templates/*\/index.tsx, which always start
   * with the shared dark HeroSection) and the platform marketing
   * homepage (which opens on its own bg-navy-950 section) opt into true.
   */
  transparentUntilScroll?: boolean;
  /**
   * Where the brand mark/name in the top-left goes. Defaults to "/" —
   * right for the platform homepage and every platform marketing page
   * (Pricing, Discover, Contact, ...). Event-scoped pages that aren't
   * the event's own one-page site (RSVP, invite, Memories, Event Day,
   * Big Screen Display, Games, Planner share) should pass the event's
   * own URL (e.g. `/events/${event.slug}`) here instead, so the brand
   * mark actually goes somewhere on those pages. Previously this was a
   * bare `<a href="#hero">`, which only ever worked on the one page
   * that actually has a `#hero` section (the event homepage itself) —
   * everywhere else, clicking the logo silently did nothing, reported
   * as "logo click doesn't work."
   */
  homeHref?: string;
}

export function Navbar({
  honoreeName = ACTIVE_EVENT.honoreeName,
  navLinks = NAV_LINKS,
  showLogin = false,
  transparentUntilScroll = false,
  homeHref = "/",
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isOnHomeHref = pathname === homeHref;

  function handleBrandClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Already on the page the brand mark points to (e.g. the event's
    // own homepage, or the platform homepage) — scroll smoothly to top
    // instead of a no-op same-URL navigation.
    if (isOnHomeHref) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  useEffect(() => {
    if (!transparentUntilScroll) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentUntilScroll]);

  const showSolidBackground = !transparentUntilScroll || scrolled;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-luxury duration-500",
        showSolidBackground
          ? "bg-navy-950/80 backdrop-blur-md shadow-[0_1px_0_0_rgba(201,162,39,0.25)]"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-ivory-50 sm:px-6 sm:py-4 lg:px-8">
        <Link
          href={homeHref}
          onClick={handleBrandClick}
          className="flex items-center gap-2 truncate font-display text-base tracking-wide text-gold-300 sm:text-lg"
        >
          {/*
            The brand mark only ever shows on platform-level pages
            (marketing site, pricing, roles, discover...), which all
            pass honoreeName={SITE_NAME} — never on a guest's personal
            event page, where honoreeName is that event's own honoree
            and showing the EveryMoment logo there would wrongly brand
            someone else's event as the platform itself.
          */}
          {honoreeName === SITE_NAME ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/everymoment-logo-icon.svg" alt="" aria-hidden="true" className="h-7 w-7 shrink-0" />
          ) : null}
          {honoreeName}
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm tracking-wide text-ivory-100/85 transition-luxury duration-300 hover:text-gold-300"
              >
                {link.label}
              </Link>
            </li>
          ))}
          {showLogin ? (
            <li className="flex items-center gap-4">
              <NavbarAuthStatus variant="desktop" />
            </li>
          ) : null}
        </ul>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="tap-target -mr-2 flex shrink-0 items-center justify-center text-ivory-50 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <div
        className={cn(
          "overflow-hidden transition-luxury duration-500 md:hidden",
          open ? "max-h-96" : "max-h-0",
        )}
      >
        <ul className="flex flex-col gap-1 bg-navy-950/95 px-4 pb-4 sm:px-6 sm:pb-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="tap-target flex items-center text-sm text-ivory-100/85 hover:text-gold-300"
              >
                {link.label}
              </Link>
            </li>
          ))}
          {showLogin ? (
            <li className="flex flex-col items-start gap-1">
              <NavbarAuthStatus variant="mobile" onNavigate={() => setOpen(false)} />
            </li>
          ) : null}
        </ul>
      </div>
    </header>
  );
}
