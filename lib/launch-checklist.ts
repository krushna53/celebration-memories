import type { EventRecord } from "@/types/event";

export type LaunchEvent = Pick<EventRecord, "id" | "slug" | "honoreeName" | "hostedBy" | "startAt" | "endAt" | "timezone" | "venueName" | "venueAddress" | "category" | "templateSlug" | "shareImagePath" | "visibility" | "publicRsvpEnabled" | "publicMemoriesEnabled" | "pageStatus"> & { viewingAccess?: string; publicAccessPinned?: boolean };

export function launchEventSummary(event: LaunchEvent, access?: { viewing_access: string; public_access_pinned: boolean } | null): LaunchEvent {
  const { id, slug, honoreeName, hostedBy, startAt, endAt, timezone, venueName, venueAddress, category, templateSlug, shareImagePath, visibility, publicRsvpEnabled, publicMemoriesEnabled, pageStatus } = event;
  return { id, slug, honoreeName, hostedBy, startAt, endAt, timezone, venueName, venueAddress, category, templateSlug, shareImagePath, visibility, publicRsvpEnabled, publicMemoriesEnabled, pageStatus, viewingAccess: access?.viewing_access, publicAccessPinned: access?.public_access_pinned };
}

export interface LaunchCheck {
  id: string;
  label: string;
  detail: string;
  href: string;
  action: string;
  automatic: boolean;
  complete?: boolean;
}

export function buildLaunchChecks(event: LaunchEvent, draftToken?: string): LaunchCheck[] {
  const settings = draftToken ? `/start/${draftToken}/basics` : "/admin/event-settings";
  const hasDetails = Boolean(event.honoreeName.trim() && event.honoreeName !== "New Event" && event.hostedBy.trim() && !event.slug.startsWith("draft-"));
  const hasVenue = Boolean(event.venueName?.trim() && event.venueAddress?.trim());
  const date = new Date(event.startAt);
  let dateLabel = "Set a valid date and timezone in Event Details.";
  if (Number.isFinite(date.getTime())) {
    try { dateLabel = `${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone }).format(date)} (${event.timezone}). Check that this is the time guests should arrive.`; } catch { /* Invalid timezone remains actionable. */ }
  }
  return [
    { id: "details", label: "Event name, host, and link", detail: hasDetails ? `${event.honoreeName} · Hosted by ${event.hostedBy}` : "Replace the draft details and choose your event link.", href: settings, action: "Edit", automatic: true, complete: hasDetails },
    { id: "date", label: "I’ve checked the date and time", detail: dateLabel, href: settings, action: "Check", automatic: false },
    { id: "venue", label: "I’ve checked the venue or joining instructions", detail: hasVenue ? `${event.venueName} · ${event.venueAddress}` : "Add an address for an in-person event, or make joining instructions clear for an online event.", href: settings, action: "Edit", automatic: false },
    { id: "privacy", label: "I’ve checked who can find and contribute to this event", detail: `${event.visibility === "public" ? "Public directory listing is enabled." : "Hidden from the public directory."} ${event.publicAccessPinned || event.viewingAccess === "public" ? "Anyone with the event link can view the page." : event.viewingAccess === "signed_in" ? "Visitors must sign in to view the page." : event.viewingAccess === "invited_only" ? "Viewing requires a verified invited account." : "Check viewing permissions in Privacy settings."} ${event.publicRsvpEnabled ? "The shared RSVP link is enabled." : "RSVP uses personal invitation links."} ${event.publicMemoriesEnabled ? "The shared memory link is enabled; uploads require approval." : "Memory uploads use personal invitation links."}${draftToken ? " Review viewing permissions in Privacy and contribution links in Event Settings after setup." : ""}`, href: draftToken ? settings : "/admin/privacy", action: "Review", automatic: false },
    { id: "preview", label: "I’ve opened the invitation as a guest", detail: `${event.shareImagePath ? "An invitation image is set." : "An invitation image is optional; you can add one later."} Open the page and check its appearance, details, and guest actions on your phone.`, href: draftToken ? `/start/${draftToken}/preview/${event.templateSlug}` : `/events/${event.slug}`, action: "Preview", automatic: false },
  ];
}
