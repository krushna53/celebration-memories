import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Settings,
  Clock,
  CalendarClock,
  Users,
  UserCog,
  UsersRound,
  Palette,
  HelpCircle,
  ImagePlus,
  Gift,
  Inbox,
  Sparkles,
  PenTool,
  QrCode,
  Wallet,
  Globe,
  Film,
  Clapperboard,
  FileClock,
  CreditCard,
  Ticket,
  LayoutGrid,
  Tags,
  MessageSquareHeart,
  ListChecks,
  Gamepad2,
  Store,
  HardDrive,
  Gauge,
} from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { signOutAction } from "@/features/admin/auth-actions";
import { isPathAllowedForRole } from "@/lib/admin-roles";
import { TOUR_STEP_COPY } from "@/lib/admin-tour-steps";
import { AdminTourController, type TourStep } from "@/features/admin/tour/admin-tour-controller";
import { FaqChatbot } from "@/features/admin/support/faq-chatbot";
import { ActiveEventBanner } from "@/features/admin/events/active-event-banner";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/events", label: "All Events", icon: Building2 },
  { href: "/admin/members", label: "Members", icon: UserCog },
  { href: "/admin/event-settings", label: "Event Settings", icon: Settings },
  { href: "/admin/team", label: "Team", icon: UsersRound },
  { href: "/admin/templates", label: "Templates", icon: Palette },
  { href: "/admin/template-submissions", label: "Template Submissions", icon: PenTool },
  { href: "/admin/invitees", label: "Invitees", icon: Users },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/admin/timeline", label: "Timeline", icon: Clock },
  { href: "/admin/event-day", label: "Event Day", icon: CalendarClock },
  { href: "/admin/memories", label: "Memories", icon: ImageIcon },
  { href: "/admin/planner", label: "Planner", icon: ListChecks },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/marketplace", label: "Marketplace", icon: Store },
  { href: "/admin/storage", label: "Storage", icon: HardDrive },
  { href: "/admin/usage", label: "Usage", icon: Gauge },
  { href: "/admin/share-image", label: "Share Image", icon: ImagePlus },
  { href: "/admin/ai-image", label: "AI Image", icon: Sparkles },
  { href: "/admin/slideshow", label: "Slideshow Video", icon: Film },
  { href: "/admin/video-editor", label: "Video Editor", icon: Clapperboard },
  { href: "/admin/domain-search", label: "Domain Search", icon: Globe },
  { href: "/admin/referrals", label: "Referrals", icon: Gift },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/admin/payment-settings", label: "Payment Settings", icon: QrCode },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/checkin", label: "Check-In", icon: CalendarCheck },
  { href: "/admin/drafts", label: "Drafts", icon: FileClock },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/pricing-settings", label: "Pricing Settings", icon: Tags },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareHeart },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Ticket },
  { href: "/admin/help", label: "Help", icon: HelpCircle },
] as const;

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  const visibleNav = NAV.filter((item) => isPathAllowedForRole(item.href, admin.role));

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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 font-display text-lg text-gold-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/everymoment-logo-icon.svg" alt="" aria-hidden="true" className="h-6 w-6 shrink-0" />
            EveryMoment · Admin
          </Link>
          <div className="flex items-center gap-4">
            {admin.role === "client" ? (
              <span className="hidden rounded-full border border-gold-500/30 px-2.5 py-1 text-xs text-gold-300 sm:inline">
                Host access
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
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {visibleNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              data-tour-id={href}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm text-ivory-100/80 transition-luxury duration-200 hover:bg-white/5 hover:text-gold-300"
            >
              <Icon size={15} /> {label}
            </Link>
          ))}
        </nav>
      </header>

      <ActiveEventBanner admin={admin} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

      <FaqChatbot />
    </div>
  );
}
