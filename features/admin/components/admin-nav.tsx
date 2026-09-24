"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ADMIN_NAV, GROUP_LABELS, GROUP_ORDER, type NavItem } from "@/lib/admin-nav";

/** The phone bottom bar's fixed tabs, in priority order — the first four this admin is allowed to see are shown. */
const PRIMARY_TAB_PREFERENCE = ["/admin", "/admin/invitees", "/admin/memories", "/admin/checkin", "/admin/event-settings", "/admin/session-attendees", "/admin/my-sessions"];

const SHORT_LABELS: Record<string, string> = {
  "/admin/event-settings": "Settings",
  "/admin/session-attendees": "Attendees",
  "/admin/my-sessions": "Sessions",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface AdminNavProps {
  /** Hrefs this admin's role may open — computed server-side. */
  allowedHrefs: string[];
}

/**
 * Admin navigation, two shapes:
 *
 * - md and up: the original horizontal strip under the header, now with
 *   the current page highlighted.
 * - Phones (incl. the installed PWA/Capacitor app): a native-style
 *   bottom tab bar with the four most-used destinations plus "More",
 *   which opens a grouped full-height sheet with everything else. The
 *   old strip showed up to 49 links in one sideways-scrolling row with
 *   only ~3 visible at a time — most of the admin was effectively
 *   undiscoverable on a phone.
 *
 * Both render `data-tour-id` so the dashboard tour
 * (features/admin/tour/admin-tour-controller.tsx) can find whichever
 * copy is visible.
 */
export function AdminNav({ allowedHrefs }: AdminNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const allowed = new Set(allowedHrefs);
  const items = ADMIN_NAV.filter((item) => allowed.has(item.href));

  const primary = PRIMARY_TAB_PREFERENCE.map((href) => items.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 4);
  const primaryHrefs = new Set(primary.map((i) => i.href));
  const moreActive = !primary.some((i) => isActive(pathname, i.href));

  // Close the sheet on navigation, and lock page scroll while it's open.
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <>
      {/* Desktop / tablet strip */}
      <nav aria-label="Admin" className="no-scrollbar mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6 md:flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              data-tour-id={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-luxury duration-200",
                active ? "bg-gold-500 text-navy-950" : "text-ivory-100/80 hover:bg-white/5 hover:text-gold-300",
              )}
            >
              <Icon size={15} /> {label}
            </Link>
          );
        })}
      </nav>

      {/* Phone bottom tab bar */}
      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  data-tour-id={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                    active ? "text-gold-300" : "text-ivory-100/65",
                  )}
                >
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-gold-500/15")}>
                    <Icon size={20} />
                  </span>
                  <span className="max-w-full truncate">{SHORT_LABELS[href] ?? label}</span>
                </Link>
              </li>
            );
          })}
          <li className={cn(primary.length < 4 && "col-start-5")}>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={cn(
                "flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                moreActive ? "text-gold-300" : "text-ivory-100/65",
              )}
            >
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-gold-500/15")}>
                <Menu size={20} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* "More" sheet */}
      {moreOpen ? (
        <div role="dialog" aria-modal="true" aria-label="All admin pages" className="fixed inset-0 z-50 flex flex-col bg-ivory-100 md:hidden">
          <div className="flex items-center justify-between border-b border-navy-950/10 bg-navy-950 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <p className="font-display text-lg text-gold-300">All Pages</p>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ivory-100/80 hover:bg-white/10"
            >
              <X size={22} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4">
            <Link
              href="/admin/simple"
              className="mb-5 flex min-h-12 items-center gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 text-sm font-medium text-navy-950"
            >
              <LayoutGrid size={18} className="text-gold-700" />
              Switch to Simple View
              <span className="ml-auto text-xs font-normal text-navy-700/60">easiest on a phone</span>
            </Link>
            {GROUP_ORDER.map((group) => {
              const groupItems = items.filter((i) => i.group === group && !primaryHrefs.has(i.href));
              if (groupItems.length === 0) return null;
              return (
                <section key={group} className="mb-5">
                  <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.15em] text-navy-700/60">{GROUP_LABELS[group]}</h2>
                  <ul className="divide-y divide-navy-950/5 overflow-hidden rounded-xl border border-navy-950/10 bg-white">
                    {groupItems.map(({ href, label, icon: Icon }) => {
                      const active = isActive(pathname, href);
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex min-h-12 items-center gap-3 px-4 text-sm",
                              active ? "bg-gold-500/10 font-medium text-navy-950" : "text-navy-800",
                            )}
                          >
                            <Icon size={18} className={active ? "text-gold-700" : "text-navy-700/50"} />
                            {label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
