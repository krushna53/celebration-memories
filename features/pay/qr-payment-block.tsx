import type { PaymentSettingsRecord } from "@/types/payment";

/**
 * Presentational QR/UPI/bank-details block — the visual half of "make a
 * payment" without the confirmation form. Shared by app/pay/page.tsx (the
 * standalone public payment page) and features/start/payment-panel.tsx
 * (the wizard's payment step, when Stripe/Razorpay checkout isn't
 * configured) so both surfaces stay in sync automatically whenever the
 * admin updates /admin/payment-settings. No hooks — safe to render from
 * either a Server Component or a "use client" one.
 */
export function QrPaymentBlock({
  settings,
  qrImageUrl,
}: {
  settings: Pick<PaymentSettingsRecord, "upiId" | "bankDetails" | "instructions">;
  qrImageUrl: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-gold-500/15 bg-white px-6 py-8 text-center shadow-sm">
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
  );
}
