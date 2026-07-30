import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getCheckoutPrereqs } from "@/features/start/actions/payment";
import { getPaymentSettings } from "@/services/payments";
import { publicMediaUrl } from "@/services/uploads";
import { PROMO_COOKIE } from "@/features/pricing/constants";
import { PaymentPanel } from "@/features/start/payment-panel";

export const dynamic = "force-dynamic";

export default async function WizardPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  const [prereqs, paymentSettings, jar] = await Promise.all([
    getCheckoutPrereqs(token, event.id),
    getPaymentSettings(),
    cookies(),
  ]);
  const qrImageUrl = paymentSettings.qrImagePath ? publicMediaUrl("gallery", paymentSettings.qrImagePath) : null;
  const initialPromoCode = jar.get(PROMO_COOKIE)?.value ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-center font-display text-2xl text-navy-950">Choose Your Plan</h1>
      <p className="mt-1 text-center text-sm text-navy-700/60">
        One last step to take {event.honoreeName}&rsquo;s site live.
      </p>
      <div className="mt-8">
        <PaymentPanel
          token={token}
          eventId={event.id}
          prereqs={prereqs}
          paymentSettings={paymentSettings}
          qrImageUrl={qrImageUrl}
          initialPromoCode={initialPromoCode}
        />
      </div>
    </div>
  );
}
