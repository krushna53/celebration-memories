-- Adds 'free' as a valid wizard_payments.provider value — used when a
-- host completes the wizard's payment step but NEITHER a card processor
-- (Stripe/Razorpay/CCAvenue) NOR manual UPI/QR/bank details are
-- configured yet on this site (see features/start/actions/payment.ts's
-- claimFreeAccessAction and payment-panel.tsx's noPaymentAvailable
-- check) — rather than blocking the host indefinitely behind a paywall
-- that has nothing to actually charge them through. Distinct from the
-- existing 'promo' provider (a deliberately-issued code) so
-- /admin/billing can tell the two apart at a glance.
alter table wizard_payments drop constraint wizard_payments_provider_check;
alter table wizard_payments add constraint wizard_payments_provider_check
  check (provider = any (array['stripe', 'razorpay', 'ccavenue', 'promo', 'free']));
