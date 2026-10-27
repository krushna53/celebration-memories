-- Date poll: the host lists a few candidate dates instead of fixing one,
-- guests tick every date that works for them (names visible to everyone,
-- Doodle-style), and the host finalises one — which copies it into
-- events.start_at / end_at and closes the poll.
--
-- While date_poll_open is true, events.start_at stays NOT NULL but holds a
-- placeholder (the earliest candidate), and every guest-facing date shows
-- "Date to be decided" instead (lib/event-display.ts, services/date-poll.ts).
alter table public.events
  add column if not exists date_poll_open boolean not null default false;

create table if not exists public.event_date_poll_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_at timestamptz not null,
  -- Null = "onwards" (no end time), same as events.has_end_time = false.
  end_at timestamptz,
  label text check (label is null or char_length(label) <= 80),
  created_at timestamptz not null default now(),
  check (end_at is null or end_at > start_at)
);

create index if not exists event_date_poll_options_event_idx
  on public.event_date_poll_options (event_id, start_at);

-- One row per (voter, date that works for them). A voter is either an
-- invitee (personal invite link) or, on the public event page, a
-- name + digits-only phone — voter_key is whichever identifies them, so
-- re-voting replaces their earlier choices instead of adding to them.
create table if not exists public.event_date_poll_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  option_id uuid not null references public.event_date_poll_options(id) on delete cascade,
  invitee_id uuid references public.invitees(id) on delete cascade,
  voter_key text not null check (char_length(voter_key) <= 80),
  voter_name text not null check (char_length(voter_name) between 1 and 80),
  voter_phone text check (voter_phone is null or voter_phone ~ '^[0-9]{7,15}$'),
  created_at timestamptz not null default now(),
  unique (option_id, voter_key)
);

create index if not exists event_date_poll_votes_event_idx
  on public.event_date_poll_votes (event_id, voter_key);

-- Server-only access via the service role, like every other table.
alter table public.event_date_poll_options enable row level security;
alter table public.event_date_poll_votes enable row level security;
