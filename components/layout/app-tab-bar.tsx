"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Compass,
  Heart,
  Home,
  Images,
  Menu,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isStandalone } from "@/lib/pwa";

interface TabLink {
  label: string;
  href: string;
}

/**
 * Which of a page's nav links earn a bottom tab, best first. Matched on
 * href (event pages use in-page anchors like #rsvp, platform pages use
 * paths like /discover); the first three matches become tabs after Home.
 * Event pages favour what a guest actually came to do (RSVP, leave a
 * memory) over browsing sections.
 */
const TAB_PRIORITY: { match: RegExp; icon: LucideIcon; short?: string }[] = [
  { match: /#rsvp|\/rsvp/, icon: CalendarCheck, short: "RSVP" },
  { match: /#memories|\/memories/, icon: Heart, short: "Memories" },
  { match: /#gallery|\/gallery/, icon: Images, short: "Gallery" },
  { match: /#details/, icon: CalendarDays, short: "Details" },
  { match: /#timeline/, icon: Clock, short: "Timeline" },
  { match: /^\/discover/, icon: Compass, short: "Discover" },
  { match: /^\/events$/, icon: CalendarDays, short: "Events" },
  { match: /^\/ai-invitation-image/, icon: Sparkles, short: "AI Image" },
];

/**
 * True when the site runs as an installed app: a home-screen PWA
 * (display-mode: standalone / iOS navigator.standalone) or the Capacitor
 * Android/iOS shell (capacitor.config.ts), whose WebView doesn't report
 * standalone. Client-only — starts false so server and first client
 * render match.
 */
export function useIsInstalledApp(): boolean {
  const [isApp, setIsApp] = useState(false);
  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    setIsApp(isStandalone() || capacitor?.isNativePlatform?.() === true);
  }, []);
  return isApp;
}

interface AppTabBarProps {
  /** From useIsInstalledApp(), owned by the Navbar (which also hides its own ☰ when this bar shows). */
  isApp: boolean;
  homeHref: string;
  navLinks: readonly TabLink[];
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/**
 * Native-style bottom tab bar for the public site — only inside the
 * installed app and only on phones, where the top-corner ☰ is a long
 * reach one-handed. Regular browser tabs keep the normal header only.
 * "Menu" opens the Navbar's existing full menu (all links + sign-in
 * state), so nothing becomes unreachable. The admin dashboard has its
 * own equivalent (features/admin/components/admin-nav.tsx).
 *
 * While shown, it tags <body> with `has-app-tabbar` so globals.css can
 * pad the page bottom and lift floating widgets (support chat, AI
 * avatar, opt-in banners — marked `data-floating`) above the bar.
 */
export function AppTabBar({ isApp, homeHref, navLinks, menuOpen, onToggleMenu }: AppTabBarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isApp) return;
    document.body.classList.add("has-app-tabbar");
    return () => document.body.classList.remove("has-app-tabbar");
  }, [isApp]);

  if (!isApp) return null;

  const tabs: { href: string; label: string; icon: LucideIcon }[] = [];
  for (const rule of TAB_PRIORITY) {
    if (tabs.length === 3) break;
    const link = navLinks.find((l) => rule.match.test(l.href));
    if (link && !tabs.some((t) => t.href === link.href)) {
      tabs.push({ href: link.href, label: rule.short ?? link.label, icon: rule.icon });
    }
  }

  // Event homepages link their own top as "#hero"; everywhere else Home
  // is the page's homeHref (the platform root, or an event's own URL).
  const homeTarget = navLinks.find((l) => l.href === "#hero")?.href ?? homeHref;
  const homeActive = pathname === homeHref && !menuOpen;

  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-navy-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        <li>
          <TabItem href={homeTarget} label="Home" icon={Home} active={homeActive} />
        </li>
        {tabs.map((tab) => (
          <li key={tab.href}>
            <TabItem href={tab.href} label={tab.label} icon={tab.icon} active={!menuOpen && pathname === tab.href} />
          </li>
        ))}
        <li className="col-start-5">
          <button
            type="button"
            onClick={onToggleMenu}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className={cn(
              "flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
              menuOpen ? "text-gold-300" : "text-ivory-100/65",
            )}
          >
            <span
              className={cn("flex h-7 w-12 items-center justify-center rounded-full", menuOpen && "bg-gold-500/15")}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </span>
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}

function TabItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
        active ? "text-gold-300" : "text-ivory-100/65",
      )}
    >
      <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-gold-500/15")}>
        <Icon size={20} />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
