import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, LogOut } from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { signOutAction } from "@/features/admin/auth-actions";
import { isPathAllowedForRole } from "@/lib/admin-roles";
import { TOUR_STEP_COPY } from "@/lib/admin-tour-steps";
import { AdminTourController, type TourStep } from "@/features/admin/tour/admin-tour-controller";
import { FaqChatbot } from "@/features/admin/support/faq-chatbot";
import { ActiveEventBanner } from "@/features/admin/events/active-event-banner";
import { NotificationBell } from "@/features/admin/notifications/notification-bell";
import { ADMIN_NAV, AdminNav } from "@/features/admin/components/admin-nav";


export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/login");
  }

  const visibleNav = ADMIN_NAV.filter((item) => isPathAllowedForRole(item.href, admin.role));

  const tourSteps: TourStep[] = visibleNav
    .map((item) => {
      const copy = TOUR_STEP_COPY[item.href];
      return copy
        ? { href: item.href as string, title: copy.title, description: copy.description }
        : null;
    })
    .filter((step): step is TourStep => step !== null);

  return (
    <div className="min-h-screen bg-ivory-100">
      <header className="border-b border-navy-950/10 bg-navy-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-4 sm:px-6 sm:py-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-2 font-display text-lg text-gold-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/everymoment-logo-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
            {/* "· Admin" drops on phones so the header stays on one line. */}
            <span className="truncate">
              EveryMoment<span className="hidden sm:inline"> · Admin</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            {admin.role === "client" ? (
              <span className="hidden rounded-full border border-gold-500/30 px-2.5 py-1 text-xs text-gold-300 sm:inline">
                Host access
              </span>
            ) : null}
            {admin.role === "session_organizer" ? (
              <span className="hidden rounded-full border border-gold-500/30 px-2.5 py-1 text-xs text-gold-300 sm:inline">
                Session Organizer
              </span>
            ) : null}
            {admin.role === "organizer" ? (
              <span className="hidden rounded-full border border-gold-500/30 px-2.5 py-1 text-xs text-gold-300 sm:inline">
                Organizer
              </span>
            ) : null}
            <Link
              href="/admin/simple"
              title="A simpler, single-page view with just the essentials"
              className="hidden items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs text-ivory-100/70 transition-luxury duration-200 hover:border-gold-500/40 hover:text-gold-300 sm:flex"
            >
              <LayoutGrid size={13} /> Simple View
            </Link>
            <AdminTourController steps={tourSteps} autoStart={!admin.hasSeenTour} />
            <NotificationBell />
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign Out"
                title="Sign Out"
                className="tap-target flex items-center justify-center gap-1.5 whitespace-nowrap text-sm text-ivory-100/70 hover:text-gold-300"
              >
                <LogOut size={16} /> <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
        <AdminNav allowedHrefs={visibleNav.map((item) => item.href)} />
      </header>

      <ActiveEventBanner admin={admin} />

      {/* Bottom padding on phones clears the fixed bottom tab bar (AdminNav). */}
      <main className="mx-auto max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:py-8">{children}</main>

      <FaqChatbot />
    </div>
  );
}
