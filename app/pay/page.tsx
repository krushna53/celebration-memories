import type { Metadata } from "next";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { PayForm } from "@/features/pay/pay-form";
import { QrPaymentBlock } from "@/features/pay/qr-payment-block";
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
            <div className="mt-10">
              <QrPaymentBlock settings={settings} qrImageUrl={qrImageUrl} />
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
