-- Per-event ("per client") payment settings — lets a host add their OWN
-- bank account / UPI ID, or their own Stripe / Razorpay / CCAvenue API
-- keys, scoped to just their event. Deliberately separate from
-- payment_provider_settings (the platform's own, single global row used
-- by the /start wizard's checkout — see services/payment-settings.ts /
-- features/start/actions/payment.ts) and from payment_settings (the
-- platform's own manual UPI/QR /pay page).
--
-- A submission is NOT usable until an owner approves it (status flips
-- pending_review -> approved) — mirrors template_submissions' review
-- model (see supabase/migrations/0005_template_submissions.sql) rather
-- than going live immediately like the platform's own billing settings,
-- since these are third-party credentials entered by an untrusted
-- client rather than the site owner.
--
-- `schedule_item_id` is nullable and unused for now (null = the event's
-- one default config) — included so a future per-session override
-- (workshop sessions each having their own payment config) doesn't need
-- a second migration; see event_schedule_items.
create table public.event_payment_settings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  schedule_item_id uuid references public.event_schedule_items(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual', 'stripe', 'razorpay', 'ccavenue')),
  -- Manual (bank transfer / UPI) fields
  bank_details text,
  upi_id text,
  -- Stripe
  stripe_secret_key text,
  -- Razorpay
  razorpay_key_id text,
  razorpay_key_secret text,
  -- CCAvenue
  ccavenue_merchant_id text,
  ccavenue_access_code text,
  ccavenue_working_key text,
  currency text not null default 'INR',
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  review_note text,
  reviewed_at timestamptz,
  submitted_by uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One default (event-level) config per event, one config per session
-- override once #63 (per-session payments) uses this column.
create unique index event_payment_settings_event_default_uq
  on public.event_payment_settings (event_id)
  where schedule_item_id is null;

create unique index event_payment_settings_session_uq
  on public.event_payment_settings (schedule_item_id)
  where schedule_item_id is not null;

create index event_payment_settings_status_idx on public.event_payment_settings (status);

-- RLS enabled with no public policies, consistent with every other
-- table in this schema — authorization is enforced in application code
-- (requireAdminForEvent / requireOwner), not database policies.
alter table public.event_payment_settings enable row level security;
