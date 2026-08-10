-- Paid-event RSVP: an event can require payment to confirm a "coming"
-- RSVP (workshops, primarily). Pricing lives on `events` (one ticket
-- price per event today — per-session pricing is #63, deferred).
alter table public.events
  add column is_paid_event boolean not null default false,
  add column rsvp_regular_price numeric,
  add column rsvp_early_bird_price numeric,
  add column rsvp_early_bird_deadline timestamptz,
  add column rsvp_currency text not null default 'INR';

-- One row per payment attempt (a guest can retry after a failed
-- attempt, so this is intentionally not unique per invitee). Charged
-- through the event's OWN approved event_payment_settings (see
-- migration 0033) — never the platform's own billing settings.
create table public.rsvp_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invitee_id uuid not null references public.invitees(id) on delete cascade,
  amount numeric not null,
  currency text not null,
  pricing_tier text not null check (pricing_tier in ('early_bird', 'regular')),
  provider text not null check (provider in ('manual', 'stripe', 'razorpay', 'ccavenue')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'rejected')),
  external_id text,
  reference_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);

create index rsvp_payments_event_idx on public.rsvp_payments (event_id);
create index rsvp_payments_invitee_idx on public.rsvp_payments (invitee_id);
create index rsvp_payments_status_idx on public.rsvp_payments (status);

alter table public.rsvp_payments enable row level security;
