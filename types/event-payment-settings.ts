export type EventPaymentProvider = "manual" | "stripe" | "razorpay" | "ccavenue";
export type EventPaymentSettingsStatus = "pending_review" | "approved" | "rejected";

/**
 * One event's own payment configuration — a host's bank/UPI details, or
 * their own Stripe/Razorpay/CCAvenue keys, submitted for an owner to
 * review before it can be used to actually charge guests. See
 * services/event-payment-settings.ts and supabase/migrations/
 * 0033_event_payment_settings.sql. Deliberately separate from the
 * platform's own global payment_provider_settings/payment_settings.
 */
export interface EventPaymentSettingsRecord {
  id: string;
  eventId: string;
  /** Null = this event's one default config. Reserved for a future per-session override (see #63) — unused today. */
  scheduleItemId: string | null;
  provider: EventPaymentProvider;
  bankDetails: string | null;
  upiId: string | null;
  /** Masked (e.g. "••••ab12") once approved/rejected — never the raw secret — except right after a fresh submission, when the client's own just-typed value is echoed back unmasked for the one render. */
  stripeSecretKey: string | null;
  razorpayKeyId: string | null;
  razorpayKeySecret: string | null;
  ccavenueMerchantId: string | null;
  ccavenueAccessCode: string | null;
  ccavenueWorkingKey: string | null;
  currency: string;
  status: EventPaymentSettingsStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the client's submission form actually sends — a blank/omitted field leaves that column untouched on resubmission, same convention as services/payment-settings.ts's XSettingsInput. */
export interface EventPaymentSettingsInput {
  provider: EventPaymentProvider;
  bankDetails?: string;
  upiId?: string;
  stripeSecretKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  ccavenueMerchantId?: string;
  ccavenueAccessCode?: string;
  ccavenueWorkingKey?: string;
  currency?: string;
}
