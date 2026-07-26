import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { PayForm } from "@/features/pay/pay-form";
import { getPaymentSettings } from "@/services/payments";
import { publicMediaUrl } from "@/services/uploads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Make a Payment — Celebration Memories",
  description: "Scan the QR code or use the UPI details below, then confirm your payment.",
};

export default async function PayPage() {
  const settings = await getPaymentSettings();
  const qrImageUrl = settings.qrImagePath ? publicMediaUrl("gallery", settings.qrImagePath) : null;

  return (
    <SiteShell honoreeName="Celebration Memories">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Payment"
            title="Make a Payment"
            description="Scan the code or use the details below in your UPI app, then let us know you've paid — we'll verify and confirm it."
          />

          <Reveal>
            <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-gold-500/15 bg-white px-6 py-8 text-center shadow-sm">
              {qrImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrImageUrl}
                  alt="Payment QR code"
                  className="h-56 w-56 rounded-lg border border-navy-950/10 object-contain"
                />
              ) : (
                <p className="text-sm text-navy-700/60">
                  Payment details haven&rsquo;t been set up yet — please check back soon.
                </p>
              )}
              {settings.upiId ? (
                <p className="text-sm text-navy-700/80">
                  <span className="font-medium text-navy-950">UPI ID:</span> {settings.upiId}
                </p>
              ) : null}
              {settings.bankDetails ? (
                <div className="w-full rounded-lg border border-navy-950/10 bg-navy-950/[0.02] p-4 text-left text-sm text-navy-700/80">
                  <p className="mb-1 font-medium text-navy-950">Bank Details</p>
                  <p className="whitespace-pre-wrap">{settings.bankDetails}</p>
                </div>
              ) : null}
              {settings.instructions ? (
                <p className="text-sm leading-relaxed text-navy-700/70">{settings.instructions}</p>
              ) : null}
            </div>
          </Reveal>

          <div className="mt-8">
            <Reveal>
              <PayForm />
            </Reveal>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
