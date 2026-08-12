/**
 * Site-wide constants for the active event.
 *
 * In the multi-event architecture these values are seeded from the
 * `events` table (see /types/event.ts and /services/events.ts). They are
 * kept here as strongly-typed fallbacks so the marketing site can render
 * instantly without waiting on a database round trip, and so local
 * development works without Supabase configured.
 */
export const SITE_NAME = "EveryMoment";

/**
 * Base URL for absolute links, metadata, and the sitemap/robots routes
 * (app/sitemap.ts, app/robots.ts). Set NEXT_PUBLIC_SITE_URL once you
 * have a real production domain — falls back to a placeholder so local
 * dev and preview builds don't need it configured. See
 * /EVERYMOMENT-BRAND.md for the domain strategy (everymoment.me is the
 * planned flagship domain).
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://everymoment.me";

/** Matches the `slug` seeded in supabase/seed.sql for the active event. */
export const EVENT_SLUG = "mahesh-75th-birthday";

/**
 * Cookie name for referral attribution. Set by middleware.ts whenever a
 * visitor lands on ANY page with a `?ref=` param (see
 * features/admin/referrals for how codes are created/shared), so the
 * attribution survives them browsing a few pages before starting the
 * signup wizard. Read once, at draft-creation time, by
 * services/event-drafts.ts's createDraftEvent — see
 * features/start/actions/begin.ts and features/pricing/actions.ts.
 */
export const REF_COOKIE = "cm_ref_code";

export const ACTIVE_EVENT = {
  honoreeName: "Mahesh J. Shah",
  eventTitle: "75 Years of Love",
  hostedBy: "Jagruti Shah",
  dayOfWeek: "Sunday",
  date: "August 23, 2026",
  startTime: "11:00 AM",
  endTime: "3:00 PM",
  isoStart: "2026-08-23T11:00:00+05:30",
} as const;

/**
 * Venue / logistics info for the Event Details section.
 *
 * NOTE: these are placeholders — the real venue name, address, maps
 * link, parking notes, and dress code have not been supplied yet.
 * Fill these in before launch; the Event Details section is written to
 * degrade gracefully (hides the map/directions button) while any of
 * these are null.
 */
export const VENUE = {
  name: null as string | null,
  address: null as string | null,
  mapsEmbedUrl: null as string | null,
  mapsDirectionsUrl: null as string | null,
  parkingInfo: null as string | null,
  dressCode: null as string | null,
} as const;

export const BUILDER = {
  name: "Krushna Web Works",
  whatsappUrl:
    "https://wa.me/919987982969?text=Hi,%20I%20visited%20your%20event%20website%20and%20would%20like%20to%20create%20something%20similar.",
} as const;

/**
 * Support/donate CTA for the platform. No payment processor is wired up
 * yet (see the Business & Growth guide for Razorpay setup steps) — this
 * currently opens a WhatsApp message so a supporter can reach out
 * directly. Once a Razorpay Payment Link or UPI ID exists, swap `url`
 * for that link (e.g. "https://rzp.io/l/your-link" or
 * "upi://pay?pa=yourvpa@bank&pn=Krushna%20Web%20Works").
 */
export const SUPPORT = {
  url: "https://wa.me/919987982969?text=Hi,%20I%27d%20like%20to%20support%20EveryMoment.",
} as const;

/**
 * "None of these fit" escape hatch shown on the Template picker (admin
 * Templates page + wizard's Template step share the one TemplatePicker
 * component, see features/admin/templates/template-picker.tsx) — opens
 * a WhatsApp chat with Krushna Web Works to request a fully custom
 * design instead of leaving a host stuck choosing between templates
 * that don't fit their event. Same click-to-chat pattern as BUILDER/
 * SUPPORT above rather than printing a raw phone number on the page.
 */
export const CUSTOM_TEMPLATE_REQUEST = {
  url: "https://wa.me/919987982969?text=Hi,%20I%27m%20not%20satisfied%20with%20the%20templates%20available%20and%20would%20like%20a%20custom%20design%20for%20my%20event.",
} as const;

/**
 * Where "someone almost signed up but dropped off" lead notifications go
 * (see services/wizard-leads.ts + lib/email.ts's
 * sendWizardAccountLeadNotification) — a fixed inbox rather than
 * ADMIN_NOTIFICATION_EMAIL (lib/email.ts, used for inquiries/payments/
 * custom-domain requests), since these are sales leads Krushna Web Works
 * specifically wants surfaced here regardless of what
 * ADMIN_NOTIFICATION_EMAIL is set to elsewhere. `whatsappDigits` (no "+"
 * or spaces) is BUILDER's own WhatsApp number, reused here only as a
 * fallback display — the actual follow-up link in the notification email
 * points at the *lead's* phone number, not this one, when captured.
 */
export const WIZARD_LEAD_NOTIFICATION = {
  email: "info@krushna53.com",
  whatsappDigits: "919987982969",
} as const;

export const NAV_LINKS = [
  { label: "Home", href: "#hero" },
  { label: "Event Details", href: "#details" },
  { label: "Gallery", href: "#gallery" },
  { label: "Timeline", href: "#timeline" },
  { label: "RSVP", href: "#rsvp" },
  { label: "Memories", href: "#memories" },
  // Absolute path, unlike every other item here (which are same-page
  // anchors) — deliberate: the Custom Form Builder (#95-101) is a
  // standalone, platform-wide tool, not part of this event, so it
  // needs to navigate away rather than scroll. Next's <Link> resolves
  // an absolute href the same way regardless of its siblings being
  // anchors.
  { label: "Build RSVP / Form", href: "/forms/new" },
] as const;
