-- Per-event version history / backup & restore (task #70).
--
-- A single generic table for every content area rather than one table
-- per area — the snapshot payload itself is opaque jsonb (the shape is
-- owned by services/event-snapshots.ts's per-area serialize/restore
-- functions, not by the schema), so adding a new snapshot-able area
-- later is additive (a new `area` value + a new pair of functions),
-- never a migration. Same config-driven-registry spirit as templates/
-- event categories/section order elsewhere in this codebase.
create table if not exists public.event_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  area text not null check (area in ('event_settings', 'gallery', 'timeline', 'invitees')),
  snapshot jsonb not null,
  label text,
  created_by uuid references public.admins (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists event_snapshots_event_area_idx
  on public.event_snapshots (event_id, area, created_at desc);

alter table public.event_snapshots enable row level security;
-- No public policies — service-role only (supabaseAdmin()), same
-- authorization-in-application-code model as every other table in this
-- project (see CLAUDE.md's "Core conventions").
