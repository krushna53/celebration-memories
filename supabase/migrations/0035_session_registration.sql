-- Per-session registration + payment (task #63) — each Event Day
-- schedule item can require registration, optionally paid, with its
-- own early-bird pricing (same shape as the event-level RSVP pricing
-- added in migration 0034).
alter table public.event_schedule_items
  add column requires_registration boolean not null default false,
  add column is_paid_session boolean not null default false,
  add column regular_price numeric,
  add column early_bird_price numeric,
  add column early_bird_deadline timestamptz,
  add column currency text not null default 'INR';

-- rsvp_payments already exists (migration 0034) — schedule_item_id
-- lets ONE payment attempt row be either an event-level RSVP payment
-- (null) or a specific session's payment (set), reusing the exact same
-- table/service/admin review UI rather than a parallel one.
alter table public.rsvp_payments
  add column schedule_item_id uuid references public.event_schedule_items(id) on delete cascade;
create index rsvp_payments_schedule_item_idx on public.rsvp_payments (schedule_item_id);

-- One row = this guest is registered for this session — created
-- immediately for a free session, or once payment succeeds for a paid
-- one. Independent of rsvp_payments so a free session's registration
-- doesn't need a payment row at all.
create table public.session_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  schedule_item_id uuid not null references public.event_schedule_items(id) on delete cascade,
  invitee_id uuid not null references public.invitees(id) on delete cascade,
  rsvp_payment_id uuid references public.rsvp_payments(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (schedule_item_id, invitee_id)
);
create index session_registrations_event_idx on public.session_registrations (event_id);
create index session_registrations_invitee_idx on public.session_registrations (invitee_id);
alter table public.session_registrations enable row level security;

-- Scopes a "session_organizer"-role admins row (admins.role has no
-- CHECK constraint — it's plain text, so the new role value needs no
-- schema change there) to one or more specific sessions. An organizer
-- admin still has admins.event_id set (so resolveAdminEvent/
-- requireAdminForEvent-style lookups keep working), but their actual
-- dashboard access is additionally narrowed to just these sessions —
-- see lib/admin-roles.ts and services/session-organizers.ts.
create table public.session_organizer_assignments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  schedule_item_id uuid not null references public.event_schedule_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (admin_id, schedule_item_id)
);
create index session_organizer_assignments_admin_idx on public.session_organizer_assignments (admin_id);
create index session_organizer_assignments_schedule_item_idx on public.session_organizer_assignments (schedule_item_id);
alter table public.session_organizer_assignments enable row level security;
