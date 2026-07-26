/**
 * Copy for the interactive admin dashboard tour
 * (features/admin/tour/admin-tour-controller.tsx). Keyed by nav `href`
 * so the tour automatically follows whatever subset of NAV a given
 * admin's role can see (app/admin/(dashboard)/layout.tsx already
 * filters NAV by role before passing it down) — no separate
 * owner/client list to keep in sync here.
 *
 * Deliberately shorter than the prose on /admin/help — this is a
 * "here's what this button does" spotlight, not the full guide.
 */
export interface TourStepCopy {
  title: string;
  description: string;
}

export const TOUR_STEP_COPY: Record<string, TourStepCopy> = {
  "/admin": {
    title: "Overview",
    description:
      "Your at-a-glance dashboard — RSVP breakdown, upload counts, most active guests, and recent activity.",
  },
  "/admin/event-settings": {
    title: "Event Settings",
    description:
      "Everything about the event itself: names, date/time, venue, visibility, link previews, and Custom CSS — including an AI helper that writes CSS from a plain-language description.",
  },
  "/admin/templates": {
    title: "Templates",
    description:
      "Pick your site's visual style. Every template uses the same sections — only colors, fonts, and animation differ. Changes apply immediately.",
  },
  "/admin/template-submissions": {
    title: "Template Submissions",
    description: "Review and approve new templates submitted for the platform.",
  },
  "/admin/invitees": {
    title: "Invitees",
    description:
      "Add guests one at a time or via CSV import. Each gets a unique invite link with one-tap WhatsApp sending, RSVP tracking, and visit history.",
  },
  "/admin/gallery": {
    title: "Gallery",
    description: "Upload photos into categories — they show up in the public Gallery immediately.",
  },
  "/admin/timeline": {
    title: "Timeline",
    description:
      "Add life-story milestones with photos, dates, and descriptions — shown as an animated timeline on the public page.",
  },
  "/admin/memories": {
    title: "Memories",
    description:
      "Every guest photo, video, audio clip, and guest book message lands here for your approval before it appears on the public Memory Wall.",
  },
  "/admin/share-image": {
    title: "Share Image",
    description:
      "Compose a downloadable invitation card with your event details — great for sharing directly in WhatsApp.",
  },
  "/admin/ai-image": {
    title: "AI Image",
    description: "Describe an image in words and generate it with AI — for a link preview, gallery photo, or inspiration.",
  },
  "/admin/slideshow": {
    title: "Slideshow Video",
    description:
      "Turn your Gallery and Timeline photos into a downloadable slideshow video, with your own background audio.",
  },
  "/admin/domain-search": {
    title: "Domain Search",
    description: "Check whether a custom domain you'd like for this event is available to register.",
  },
  "/admin/referrals": {
    title: "Referrals",
    description: "Create shareable referral links for anyone promoting the platform — visits track automatically.",
  },
  "/admin/inquiries": {
    title: "Inquiries",
    description: "Messages submitted through the public Contact Us page land here.",
  },
  "/admin/payment-settings": {
    title: "Payment Settings",
    description: "Configure how you accept contributions or payments from guests.",
  },
  "/admin/payments": {
    title: "Payments",
    description: "Review payment submissions from guests.",
  },
  "/admin/checkin": {
    title: "Check-In",
    description: "On event day, search a guest by name and check them in — see live attendance as guests arrive.",
  },
  "/admin/help": {
    title: "Help",
    description: "The full written guide to every feature, plus a link to what your guests see. Come back here anytime.",
  },
};
