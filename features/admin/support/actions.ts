"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { createInquiry } from "@/services/inquiries";
import { sendCustomDomainRequestNotification } from "@/lib/email";

export type RequestDomainResult = { success: true } | { success: false; error: string };

/**
 * Sent from the admin dashboard's FAQ chatbot (features/admin/support/faq-chatbot.tsx)
 * when a host asks about a custom domain. Saves to the existing
 * `inquiries` table (so it shows up in /admin/inquiries even if the
 * email below doesn't land) and separately emails the owner directly —
 * see lib/email.ts's sendCustomDomainRequestNotification. This only
 * collects the request; actually pointing a domain at this app is a
 * manual step the owner does afterward (see the README's "Custom
 * Domains" section for the exact steps).
 */
export async function requestCustomDomainAction(domain: string, notes: string): Promise<RequestDomainResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  if (!domain.trim()) return { success: false, error: "Enter the domain you'd like to use." };

  const event = await resolveAdminEvent(admin);
  const eventSlug = event?.slug ?? "unknown event";

  const message = `Custom domain request: "${domain.trim()}"\n\nEvent: ${eventSlug}\n\n${notes.trim() || "(no additional notes)"}`;

  try {
    await createInquiry({ name: admin.name || admin.email, email: admin.email, message });
  } catch (err) {
    console.error("requestCustomDomainAction failed to save inquiry:", err);
    return { success: false, error: "Something went wrong sending your request. Please try again." };
  }

  sendCustomDomainRequestNotification({
    adminName: admin.name || admin.email,
    adminEmail: admin.email,
    eventSlug,
    domain: domain.trim(),
    notes: notes.trim(),
  }).catch((err) => console.error("sendCustomDomainRequestNotification failed:", err));

  return { success: true };
}
