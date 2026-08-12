-- Spam defense for the Custom Form Builder's public, no-login
-- submission endpoint (see services/custom-form-rate-limit.ts). Mirrors
-- public_ai_image_requests' shape (ip_hash + created_at, counted over
-- a rolling window) but scoped per-form rather than global, since each
-- form is an independent surface a bot might target.
create table if not exists custom_form_submission_requests (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references custom_forms (id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_form_submission_requests_form_ip_idx
  on custom_form_submission_requests (form_id, ip_hash, created_at);

alter table custom_form_submission_requests enable row level security;
