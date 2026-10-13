-- WhatsApp contact button (any event; offered prominently for corporate
-- events): digits only, country code included, shown next to RSVP as a
-- wa.me link. Filled from the invitation card when it prints a WhatsApp
-- number, or from Event Settings.
--
-- card_theme: colours + font style read off the invitation card
-- ({"background","text","accent","font"}), used by the "Matched to your
-- card" template (lib/card-theme.ts). Validated in application code.
alter table public.events
  add column if not exists whatsapp_contact text,
  add column if not exists whatsapp_contact_label text,
  add column if not exists card_theme jsonb;

alter table public.events
  add constraint events_whatsapp_contact_format check (whatsapp_contact is null or whatsapp_contact ~ '^[0-9]{8,15}$'),
  add constraint events_whatsapp_contact_label_length check (whatsapp_contact_label is null or char_length(whatsapp_contact_label) <= 60);
