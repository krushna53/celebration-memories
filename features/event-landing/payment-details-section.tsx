import { Landmark } from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { getPaymentDetails } from "@/services/payment-details";
import { CopyPaymentDetailsButton } from "@/features/event-landing/copy-payment-details-button";

/**
 * "Payment Details" homepage section (services/payment-details.ts) — the
 * host's text (packages, bank details; line breaks and emojis kept) and/or
 * an image such as a payment QR code. Renders nothing when the event has
 * neither, so existing events are unchanged.
 */
export async function PaymentDetailsSection({ eventId, eventName }: { eventId: string; eventName: string }) {
  const details = await getPaymentDetails(eventId);
  if (!details) return null;

  return (
    <section id="payment" className="bg-ivory-50 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <SectionHeading eyebrow="Contribution" title="Payment Details" description="Packages, prices and how to pay." />
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-gold-500/20 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gold-500/15 bg-gold-500/5 px-6 py-4 text-navy-950">
              <Landmark size={18} className="text-gold-600" aria-hidden="true" />
              <span className="text-sm font-medium uppercase tracking-[0.2em]">Payment</span>
            </div>
            <div className="grid gap-8 px-6 py-6 sm:px-8 sm:py-8">
              {details.text ? (
                <div>
                  <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-navy-950 sm:text-base">{details.text}</p>
                  <div className="mt-5">
                    <CopyPaymentDetailsButton text={details.text} />
                  </div>
                </div>
              ) : null}
              {details.imageUrl ? (
                <a href={details.imageUrl} target="_blank" rel="noopener noreferrer" className="mx-auto block w-full max-w-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={details.imageUrl}
                    alt={`Payment details for ${eventName}`}
                    loading="lazy"
                    className="h-auto w-full rounded-xl border border-navy-950/10 object-contain"
                  />
                  <span className="mt-2 block text-center text-xs text-navy-700/60">Tap to open full size</span>
                </a>
              ) : null}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
