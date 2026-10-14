import { MessageCircle } from "lucide-react";

import { getEventWhatsAppContact } from "@/services/event-extras";
import { eventContactWhatsAppUrl } from "@/lib/whatsapp";

/**
 * "Message us on WhatsApp" — a wa.me link to the host's number, shown just
 * above RSVP (event page and invite page) when the event has one
 * (services/event-extras.ts). Renders nothing otherwise, so existing
 * events are unchanged.
 */
export async function WhatsAppContactButton({
  eventId,
  eventName,
  variant = "band",
}: {
  eventId: string;
  eventName: string;
  variant?: "band" | "inline";
}) {
  const contact = await getEventWhatsAppContact(eventId);
  if (!contact) return null;

  const href = eventContactWhatsAppUrl(contact.number, eventName);
  const link = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1f7a5c] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-luxury duration-200 hover:brightness-110"
    >
      <MessageCircle size={18} aria-hidden="true" />
      {contact.label || "Message us on WhatsApp"}
    </a>
  );

  if (variant === "inline") return <div className="mb-6 flex justify-center">{link}</div>;

  return (
    <div className="bg-ivory-50 pt-16 text-center sm:pt-20">
      <p className="text-sm text-navy-700/70">Have a question before the event?</p>
      <div className="mt-3 flex justify-center">{link}</div>
    </div>
  );
}
