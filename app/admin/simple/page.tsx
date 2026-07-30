import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Images,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { getDashboardStats } from "@/services/admin-stats";
import { getSetupProgressCounts } from "@/services/admin-setup-progress";
import { getLatestCompletedAiImageJob, getLatestUploadedAiImageJob } from "@/services/ai-image-jobs";
import { getLatestCompletedSlideshowVideoJob } from "@/services/slideshow-video-jobs";
import { signOutAction } from "@/features/admin/auth-actions";
import { StatCard } from "@/features/admin/components/stat-card";
import { QuickShareLinks } from "@/features/admin/simple/quick-share-links";
import { ActiveEventBanner } from "@/features/admin/events/active-event-banner";
import { VisibilityToggle } from "@/features/admin/events/visibility-toggle";

export const dynamic = "force-dynamic";

/**
 * Alternative minimalist landing for clients who find the full dashboard's
 * ~20 nav tabs overwhelming (see app/admin/(dashboard)/layout.tsx's NAV).
 * Deliberately a standalone route OUTSIDE the (dashboard) route group —
 * same pattern as /admin/login and /admin/register — so it gets its own
 * slim header instead of the full tab bar. Purely additive: doesn't touch
 * CLIENT_ALLOWED_PATHS, the existing nav, or the default post-login
 * landing route (which stays /admin). Big cards here just link out to the
 * existing full pages rather than re-implementing any of their forms.
 */
export default async function AdminSimplePage() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  const event = await resolveAdminEvent(admin);
  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory-100 px-4 text-center">
        <p className="max-w-sm text-navy-700">
          No event is assigned to this account yet. Contact the site owner to get linked to your event.
        </p>
      </div>
    );
  }

  const [stats, setupCounts, latestGeneratedAiImage, latestUploadedAiImage, latestSlideshowVideo] = await Promise.all([
    getDashboardStats(event.id),
    getSetupProgressCounts(event.id),
    getLatestCompletedAiImageJob(event.id),
    getLatestUploadedAiImageJob(event.id),
    getLatestCompletedSlideshowVideoJob(event.id),
  ]);

  const actionCards: Array<{
    href: string;
    icon: typeof Settings;
    label: string;
    description: string;
    badge: number | null;
    done: boolean;
    /** Opens in a new tab, rendered as a small link below the card rather than inside its <Link> (a card can't nest another link). Used by Memories to jump straight to the live, Pinterest-style Memory Wall instead of just the moderation queue. */
    secondaryLink?: { label: string; href: string };
  }> = [
    {
      href: "/admin/event-settings",
      icon: Settings,
      label: "Event Settings",
      description: "Date, venue, links, and page sections.",
      badge: null,
      done: Boolean(event.venueName?.trim() && event.venueAddress?.trim()),
    },
    {
      href: "/admin/gallery",
      icon: ImageIcon,
      label: "Gallery",
      description: "Your event photos, organized by category.",
      badge: null,
      done: setupCounts.galleryPhotoCount > 0,
    },
    {
      href: "/admin/timeline",
      icon: Clock,
      label: "Timeline",
      description: "The story, milestone by milestone.",
      badge: null,
      done: setupCounts.timelineMilestoneCount > 0,
    },
    {
      href: "/admin/memories",
      icon: Images,
      label: "Memories",
      description: "Approve photos, videos, audio, and notes from guests.",
      badge: stats.uploads.pendingApproval > 0 ? stats.uploads.pendingApproval : null,
      done: setupCounts.approvedMemoryCount > 0,
      secondaryLink: { label: "View Memory Wall", href: `/events/${event.slug}#memories` },
    },
    {
      href: "/admin/ai-image",
      icon: Sparkles,
      label: "AI Image",
      description: "Generate an invitation image from a text prompt.",
      badge: null,
      done: Boolean(latestGeneratedAiImage || latestUploadedAiImage),
    },
    {
      href: "/admin/slideshow",
      icon: Film,
      label: "Slideshow Video",
      description: "Turn your gallery into a music video.",
      badge: null,
      done: Boolean(latestSlideshowVideo),
    },
  ];

  const doneCount = actionCards.filter((c) => c.done).length;
  const progressPercent = Math.round((doneCount / actionCards.length) * 100);

  return (
    <div className="min-h-screen bg-ivory-100">
      <header className="border-b border-navy-950/10 bg-navy-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/admin/simple" className="font-display text-lg text-gold-300">
            Celebration Memories
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 text-sm text-ivory-100/70 hover:text-gold-300 sm:flex"
            >
              <LayoutDashboard size={15} /> Full Dashboard
            </Link>
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

      <ActiveEventBanner admin={admin} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="grid gap-8">
          <div>
            <h1 className="font-display text-2xl text-navy-950">{event.honoreeName}</h1>
            <p className="mt-1 text-sm text-navy-700/60">{event.eventTitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Coming" value={stats.invitations.coming} />
            <StatCard label="Checked In" value={stats.invitations.checkedIn} />
            <StatCard label="Pending Approval" value={stats.uploads.pendingApproval} />
            <StatCard label="Photos & Videos" value={stats.uploads.photos + stats.uploads.videos} />
          </div>

          <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
            <div>
              <h2 className="font-display text-lg text-navy-950">Share This Event</h2>
              <p className="mt-1 text-xs text-navy-700/50">
                Copy a link or send it straight to WhatsApp.
              </p>
            </div>
            <QuickShareLinks
              slug={event.slug}
              hostedBy={event.hostedBy}
              honoreeName={event.honoreeName}
              eventTitle={event.eventTitle}
              publicRsvpEnabled={event.publicRsvpEnabled}
              publicMemoriesEnabled={event.publicMemoriesEnabled}
            />
            <VisibilityToggle eventId={event.id} visibility={event.visibility} variant="full" />
          </section>

          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg text-navy-950">What would you like to do?</h2>
              <span className="shrink-0 text-xs font-medium text-navy-700/50">
                {doneCount} of {actionCards.length} set up
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-950/8">
              <div
                className="h-full rounded-full bg-gold-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {actionCards.map(({ href, icon: Icon, label, description, badge, done, secondaryLink }) => (
                <div key={href} className="grid gap-1.5">
                  <Link
                    href={href}
                    className="group flex items-start gap-3 rounded-xl border border-navy-950/10 bg-white p-4 transition-luxury duration-200 hover:border-gold-500/40 hover:shadow-sm"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        done ? "bg-gold-500/20 text-gold-700" : "bg-gold-500/10 text-gold-700"
                      }`}
                    >
                      {done ? <Check size={18} /> : <Icon size={18} />}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-navy-950">{label}</span>
                        {badge ? (
                          <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[10px] font-semibold text-navy-950">
                            {badge}
                          </span>
                        ) : done ? (
                          <span className="rounded-full bg-gold-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold-700">
                            Done
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-navy-700/60">{description}</span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="mt-2 shrink-0 text-navy-950/20 transition-luxury duration-200 group-hover:translate-x-0.5 group-hover:text-gold-500"
                    />
                  </Link>
                  {secondaryLink ? (
                    <a
                      href={secondaryLink.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap-target ml-1 flex w-fit items-center gap-1 text-xs text-navy-700/50 hover:text-gold-700"
                    >
                      {secondaryLink.label} <ExternalLink size={11} />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <p className="text-center text-sm text-navy-700/50">
            Need something else — Templates, Check-In, Domain Search?{" "}
            <Link href="/admin" className="font-medium text-gold-700 underline underline-offset-4 hover:text-gold-800">
              Open the full dashboard
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
