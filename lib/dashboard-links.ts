import { isPathAllowedForRole } from "@/lib/admin-roles";
import type { AdminRole } from "@/services/admin-auth";

export interface DashboardLink { href: string; label: string }
const LINKS: DashboardLink[] = [
  { href: "/admin/event-settings", label: "Event Settings" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/invitees", label: "Invitees (RSVP updates)" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/timeline", label: "Timeline" },
  { href: "/admin/event-day", label: "Schedule" },
  { href: "/admin/memories", label: "Memories" },
  { href: "/admin/media-library", label: "Media Library" },
  { href: "/admin/planner", label: "Planner" },
  { href: "/admin/games", label: "Games" },
  { href: "/admin/ai-video", label: "AI Video" },
  { href: "/admin/slideshow", label: "AI Slideshow" },
  { href: "/admin/reels", label: "AI Guest Reels" },
];
export function dashboardLinksForRole(role: AdminRole): DashboardLink[] {
  return LINKS.filter((link) => isPathAllowedForRole(link.href, role));
}
