import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarCheck,
  Image as ImageIcon,
  LayoutDashboard,
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
  Tags,
  MessageSquareHeart,
  ListChecks,
  Gamepad2,
  Store,
  HardDrive,
  Gauge,
  Server,
  Landmark,
  ShieldCheck,
  ReceiptText,
  UserRoundCog,
  History,
  Trash2,
  RotateCcw,
  LayoutPanelTop,
  Video,
  Wand2,
  UserRoundPlus,
  ClipboardCheck,
} from "lucide-react";

/*
 * Plain shared module (no "use client") on purpose: the admin layout is
 * a Server Component and reads ADMIN_NAV to filter by role and build the
 * tour steps. Exporting this array from the "use client" nav component
 * instead handed the server a client-reference proxy rather than the
 * array, and `ADMIN_NAV.filter` crashed every admin page.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
}

export type NavGroup = "Event" | "Guests" | "Create" | "Payments" | "Account" | "Platform";

/**
 * Every admin destination, in the order the desktop strip shows them.
 * `group` drives the mobile "More" sheet's sections. Which items a
 * given admin actually sees is decided server-side
 * (app/admin/(dashboard)/layout.tsx filters by isPathAllowedForRole and
 * passes `allowedHrefs`) — this list is presentation only.
 */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, group: "Event" },
  { href: "/admin/events", label: "All Events", icon: Building2, group: "Event" },
  { href: "/admin/members", label: "Members", icon: UserCog, group: "Platform" },
  { href: "/admin/event-settings", label: "Event Settings", icon: Settings, group: "Event" },
  { href: "/admin/team", label: "Team", icon: UsersRound, group: "Event" },
  { href: "/admin/templates", label: "Templates", icon: Palette, group: "Event" },
  { href: "/admin/template-submissions", label: "Template Submissions", icon: PenTool, group: "Platform" },
  { href: "/admin/invitees", label: "Invitees", icon: Users, group: "Guests" },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon, group: "Event" },
  { href: "/admin/timeline", label: "Timeline", icon: Clock, group: "Event" },
  { href: "/admin/event-day", label: "Event Day", icon: CalendarClock, group: "Event" },
  { href: "/admin/session-attendees", label: "Session Attendees", icon: ClipboardCheck, group: "Guests" },
  { href: "/admin/memories", label: "Memories", icon: ImageIcon, group: "Guests" },
  { href: "/admin/media-library", label: "Media Library", icon: LayoutPanelTop, group: "Guests" },
  { href: "/admin/planner", label: "Planner", icon: ListChecks, group: "Event" },
  { href: "/admin/games", label: "Games", icon: Gamepad2, group: "Event" },
  { href: "/admin/marketplace", label: "Marketplace", icon: Store, group: "Platform" },
  { href: "/admin/storage", label: "Storage", icon: HardDrive, group: "Platform" },
  { href: "/admin/usage", label: "Usage", icon: Gauge, group: "Platform" },
  { href: "/admin/platform-usage", label: "Platform Utilization", icon: Server, group: "Platform" },
  { href: "/admin/share-image", label: "Share Image", icon: ImagePlus, group: "Create" },
  { href: "/admin/ai-image", label: "AI Image", icon: Sparkles, group: "Create" },
  { href: "/admin/ai-video", label: "AI Video", icon: Wand2, group: "Create" },
  { href: "/admin/slideshow", label: "Slideshow Video", icon: Film, group: "Create" },
  { href: "/admin/timeline-movie", label: "AI Timeline Movie", icon: Wand2, group: "Create" },
  { href: "/admin/video-editor", label: "Video Editor", icon: Clapperboard, group: "Create" },
  { href: "/admin/domain-search", label: "Domain Search", icon: Globe, group: "Create" },
  { href: "/admin/payment-settings-request", label: "My Payment Method", icon: Landmark, group: "Payments" },
  { href: "/admin/payment-settings-review", label: "Payment Approvals", icon: ShieldCheck, group: "Payments" },
  { href: "/admin/rsvp-payments", label: "RSVP Payments", icon: ReceiptText, group: "Payments" },
  { href: "/admin/session-organizers", label: "Session Organizers", icon: UserRoundCog, group: "Guests" },
  { href: "/admin/organizers", label: "Organizers", icon: UserRoundPlus, group: "Guests" },
  { href: "/admin/my-sessions", label: "My Sessions", icon: CalendarClock, group: "Guests" },
  { href: "/admin/backups", label: "Backups", icon: History, group: "Account" },
  { href: "/admin/recycle-bin", label: "Recycle Bin", icon: RotateCcw, group: "Account" },
  { href: "/admin/delete-account", label: "Delete Account", icon: Trash2, group: "Account" },
  { href: "/admin/referrals", label: "Referrals", icon: Gift, group: "Account" },
  { href: "/admin/inquiries", label: "Inquiries", icon: Inbox, group: "Platform" },
  { href: "/admin/payment-settings", label: "Payment Settings", icon: QrCode, group: "Payments" },
  { href: "/admin/payments", label: "Payments", icon: Wallet, group: "Payments" },
  { href: "/admin/checkin", label: "Check-In", icon: CalendarCheck, group: "Guests" },
  { href: "/admin/drafts", label: "Drafts", icon: FileClock, group: "Platform" },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, group: "Payments" },
  { href: "/admin/pricing-settings", label: "Pricing Settings", icon: Tags, group: "Platform" },
  { href: "/admin/platform-video", label: "Feature Video", icon: Video, group: "Platform" },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareHeart, group: "Platform" },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Ticket, group: "Payments" },
  { href: "/admin/concierge-inquiries", label: "Concierge Leads", icon: Inbox, group: "Platform" },
  { href: "/admin/help", label: "Help", icon: HelpCircle, group: "Account" },
];

export const GROUP_ORDER: NavGroup[] = ["Event", "Guests", "Create", "Payments", "Account", "Platform"];

export const GROUP_LABELS: Record<NavGroup, string> = {
  Event: "Your Event",
  Guests: "Guests & Memories",
  Create: "Create & Share",
  Payments: "Payments",
  Account: "Account & Help",
  Platform: "Platform (Owner)",
};

