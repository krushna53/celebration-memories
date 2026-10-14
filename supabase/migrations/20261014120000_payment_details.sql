-- Payment details for an event (package prices, bank details, a QR code…),
-- shown in their own homepage section (features/event-landing/payment-details-section.tsx)
-- and edited in Event Settings. Text and/or an image in the private
-- `gallery` bucket under <event_id>/payment/. Null = no section.
alter table public.events
  add column if not exists payment_details_text text,
  add column if not exists payment_details_image_path text;

alter table public.events
  add constraint events_payment_details_text_length check (payment_details_text is null or char_length(payment_details_text) <= 4000);
