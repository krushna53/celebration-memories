import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  UsersRound,
  Palette,
  Image as ImageIcon,
  Clock,
  CalendarClock,
  Images,
  ListChecks,
  Gamepad2,
  ImagePlus,
  Sparkles,
  Film,
  Clapperboard,
  Globe,
  Landmark,
  ReceiptText,
  UserRoundCog,
  History,
  RotateCcw,
  Trash2,
  LayoutPanelTop,
  HelpCircle,
  Settings,
  LayoutDashboard,
  LogOut,
  ExternalLink,
  CalendarCheck,
  MonitorPlay,
  LayoutGrid,
  List,
} from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { getDashboardStats } from "@/services/admin-stats";
import { isPathAllowedForRole } from "@/lib/admin-roles";
import { signOutAction } from "@/features/admin/auth-actions";
import { NotificationBell } from "@/features/admin/notifications/notification-bell";
import { ActiveEventBanner } from "@/features/admin/events/active-event-banner";
import { ViewSwitcher } from "@/features/admin/components/view-switcher";

export const dynamic = "force-dynamic";

/**
 * A phone-home-screen-style quick launcher for the client — every page
 * they can reach, as a big colorful rounded app icon + label (optional
 * badge count), instead of the full dashboard's tab bar or
 * /admin/simple's vertical list of cards. Same standalone-route pattern
 * as /admin/simple (own slim header, outside the (dashboard) route
 * group) and the same access rules (isPathAllowedForRole,
 * shouldRedirectSessionOrganizerAway) — this is purely a different
 * presentation of the same link set, not a new permission surface.
 */
interface AppTile {
  href: string;
  label: string;
  icon: typeof Settings;
  /** Tailwind bg-* class for the icon tile — deliberately a varied,
   * saturated palette (not the site's restrained navy/gold/ivory
   * theme) so each icon reads instantly at a glance, phone-home-screen
   * style, per the client's explicit ask for something "lively." */
  color: string;
}

const APP_TILES: AppTile[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, color: "bg-slate-600" },
  { href: "/admin/event-settings", label: "Event Settings", icon: Settings, color: "bg-zinc-500" },
  { href: "/admin/invitees", label: "Invitees", icon: Users, color: "bg-blue-500" },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon, color: "bg-purple-500" },
  { href: "/admin/timeline", label: "Timeline", icon: Clock, color: "bg-amber-500" },
  { href: "/admin/event-day", label: "Event Day", icon: CalendarClock, color: "bg-teal-500" },
  { href: "/admin/memories", label: "Memories", icon: Images, color: "bg-rose-500" },
  { href: "/admin/media-library", label: "Media Library", icon: LayoutPanelTop, color: "bg-violet-600" },
  { href: "/admin/rsvp-payments", label: "RSVP Payments", icon: ReceiptText, color: "bg-green-600" },
  { href: "/admin/payment-settings-request", label: "Payment Method", icon: Landmark, color: "bg-emerald-600" },
  { href: "/admin/templates", label: "Templates", icon: Palette, color: "bg-pink-500" },
  { href: "/admin/team", label: "Team", icon: UsersRound, color: "bg-cyan-500" },
  { href: "/admin/session-organizers", label: "Session Organizers", icon: UserRoundCog, color: "bg-stone-500" },
  { href: "/admin/planner", label: "Planner", icon: ListChecks, color: "bg-lime-600" },
  { href: "/admin/games", label: "Games", icon: Gamepad2, color: "bg-fuchsia-500" },
  { href: "/admin/ai-image", label: "AI Image", icon: Sparkles, color: "bg-violet-500" },
  { href: "/admin/slideshow", label: "Slideshow Video", icon: Film, color: "bg-red-500" },
  { href: "/admin/video-editor", label: "Video Editor", icon: Clapperboard, color: "bg-indigo-500" },
  { href: "/admin/share-image", label: "Share Image", icon: ImagePlus, color: "bg-orange-500" },
  { href: "/admin/domain-search", label: "Domain Search", icon: Globe, color: "bg-sky-500" },
  { href: "/admin/backups", label: "Backups", icon: History, color: "bg-yellow-600" },
  { href: "/admin/recycle-bin", label: "Recycle Bin", icon: RotateCcw, color: "bg-slate-500" },
  { href: "/admin/delete-account", label: "Delete Account", icon: Trash2, color: "bg-red-700" },
  { href: "/admin/help", label: "Help", icon: HelpCircle, color: "bg-gray-500" },
];

function AppsHeader() {
  return (
    <header className="border-b border-navy-950/10 bg-navy-950">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/admin/apps" className="flex items-center gap-2 font-display text-lg text-gold-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/everymoment-logo-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
          EveryMoment
        </Link>
        <div className="flex items-center gap-4">
          <ViewSwitcher active="apps" />
          <Link
            href="/admin"
            className="hidden items-center gap-1.5 text-sm text-ivory-100/70 hover:text-gold-300 sm:flex"
          >
            <LayoutGrid size={15} /> Full Dashboard
          </Link>
          <NotificationBell />
          <form action={signOutAction}>
            <button
              type="submit"
              className="tap-target flex items-center gap-1.5 text-sm text-ivory-100/70 hover:text-gold-300"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export default async function AdminAppsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role === "session_organizer") redirect("/admin/my-sessions");

  const event = await resolveAdminEvent(admin);
  if (!event) {
    if (admin.role === "client") redirect("/start");
    return (
      <div className="min-h-screen bg-ivory-100">
        <AppsHeader />
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
          <p className="max-w-sm text-navy-700">
            No event is assigned to this account yet. Contact the site owner to get linked to your event.
          </p>
        </div>
      </div>
    );
  }

  const stats = await getDashboardStats(event.id);
  const tiles = APP_TILES.filter((tile) => isPathAllowedForRole(tile.href, admin.role));

  const shortcuts = [
    { href: `/events/${event.slug}`, label: "Web Page", icon: ExternalLink, color: "bg-navy-700", external: true },
    { href: `/events/${event.slug}/rsvp`, label: "RSVP Link", icon: CalendarCheck, color: "bg-blue-600", external: true },
    { href: `/events/${event.slug}/display`, label: "Big Screen", icon: MonitorPlay, color: "bg-gold-600", external: true },
  ];

  return (
    <div className="min-h-screen bg-ivory-100">
      <AppsHeader />
      <ActiveEventBanner admin={admin} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-display text-2xl text-navy-950">{event.honoreeName}</h1>
          <p className="mt-1 text-sm text-navy-700/60">{event.eventTitle} — every page, one tap away.</p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
          {shortcuts.map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href} target="_blank" className="group flex flex-col items-center gap-1.5">
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color} text-white shadow-sm transition-luxury duration-200 group-hover:scale-105 group-hover:shadow-md sm:h-16 sm:w-16`}
              >
                <Icon size={26} />
              </span>
              <span className="text-center text-xs font-medium text-navy-700 sm:text-sm">{label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 border-t border-navy-950/10 pt-8">
          <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4">
            {tiles.map(({ href, label, icon: Icon, color }) => {
              const badge = href === "/admin/memories" && stats.uploads.pendingApproval > 0 ? stats.uploads.pendingApproval : null;
              return (
                <Link key={href} href={href} className="group flex flex-col items-center gap-1.5">
                  <span className="relative">
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${color} text-white shadow-sm transition-luxury duration-200 group-hover:scale-105 group-hover:shadow-md sm:h-16 sm:w-16`}
                    >
                      <Icon size={26} />
                    </span>
                    {badge ? (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white ring-2 ring-ivory-100">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-center text-xs font-medium text-navy-700 sm:text-sm">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-navy-700/50">
          Prefer a list with progress and hints instead? Use the{" "}
          <List size={12} className="inline -mt-0.5" aria-hidden="true" /> switch above.
        </p>
      </main>
    </div>
  );
}
