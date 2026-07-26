-- ============================================================================
-- Celebration Memories — Phase 3 schema
-- Core multi-event, invitee, RSVP, and activity-tracking tables.
--
-- Design notes:
--   * Every guest-facing table is scoped by `event_id`, so the same schema
--     supports many concurrent events (see CLAUDE.md → multi-event platform).
--   * RLS is enabled on every table with NO public policies attached. All
--     reads/writes go through Server Actions / Route Handlers using the
--     Supabase service-role key (see lib/supabase/admin.ts), which bypasses
--     RLS. The invite token itself is the guest's "credential" — there is
--     no Supabase Auth session for guests, so client-side anon access must
--     stay fully locked down.
--   * Phase 4 (photos/videos/audio/guestbook) and Phase 5 (admins) tables
--     are added in later migrations to keep each phase's schema change
--     reviewable on its own.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- events
-- ----------------------------------------------------------------------------
create type event_category as enum (
  'birthday',
  'wedding',
  'anniversary',
  'retirement',
  'baby_shower',
  'corporate'
);

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category event_category not null default 'birthday',
  honoree_name text not null,
  event_title text not null,
  hosted_by text not null,
  venue_name text,
  venue_address text,
  maps_url text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  dress_code text,
  hero_video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events enable row level security;

-- ----------------------------------------------------------------------------
-- invitees
-- ----------------------------------------------------------------------------
create type rsvp_status as enum ('pending', 'coming', 'maybe', 'not_coming');

create table invitees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  token text not null unique,
  name text not null,
  phone text,
  email text,
  relationship text,
  opened_at timestamptz,
  last_opened_at timestamptz,
  visit_count integer not null default 0,
  rsvp_status rsvp_status not null default 'pending',
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invitees_event_id_idx on invitees (event_id);
create index invitees_token_idx on invitees (token);

alter table invitees enable row level security;

-- ----------------------------------------------------------------------------
-- rsvps
-- ----------------------------------------------------------------------------
create type meal_preference as enum (
  'no_preference',
  'vegetarian',
  'vegan',
  'jain',
  'gluten_free',
  'other'
);

create table rsvps (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid not null unique references invitees (id) on delete cascade,
  -- Guest's attendance response. Reuses the rsvp_status enum but never
  -- stores 'pending' here — a row only exists once a guest has responded.
  coming rsvp_status not null,
  adults integer not null default 1,
  children integer not null default 0,
  meal_preference meal_preference not null default 'no_preference',
  comments text,
  submitted_at timestamptz not null default now(),
  constraint rsvps_coming_not_pending check (coming <> 'pending')
);

alter table rsvps enable row level security;

-- ----------------------------------------------------------------------------
-- activity_logs — invitation open / visit tracking
-- ----------------------------------------------------------------------------
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid not null references invitees (id) on delete cascade,
  event_type text not null, -- e.g. 'invite_opened', 'rsvp_submitted'
  device text,
  browser text,
  operating_system text,
  referral text,
  created_at timestamptz not null default now()
);

create index activity_logs_invitee_id_idx on activity_logs (invitee_id);

alter table activity_logs enable row level security;

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

create trigger invitees_set_updated_at
  before update on invitees
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- record_invite_visit — atomic "opened_at / last_opened_at / visit_count"
-- update, called every time a guest opens their invite link.
-- ----------------------------------------------------------------------------
create or replace function record_invite_visit(p_invitee_id uuid)
returns void
language sql
set search_path = public
as $$
  update invitees
  set
    opened_at = coalesce(opened_at, now()),
    last_opened_at = now(),
    visit_count = visit_count + 1
  where id = p_invitee_id;
$$;
