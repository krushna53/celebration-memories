-- Workshop feature (#106) Phase 4-5: per-session QR check-in and
-- attributing a linked Custom Form Builder submission back to the
-- guest who registered, so the attendee table can show both.

alter table session_registrations
  add column if not exists qr_token text unique,
  add column if not exists attended_at timestamptz,
  add column if not exists checked_in_by uuid references admins (id) on delete set null;

create index if not exists session_registrations_qr_token_idx on session_registrations (qr_token);

alter table custom_form_responses
  add column if not exists session_registration_id uuid references session_registrations (id) on delete set null;

create index if not exists custom_form_responses_session_registration_id_idx on custom_form_responses (session_registration_id);
