-- Guests contributing photos to the Timeline (/events/[slug]/timeline/share):
-- each submission waits for the host's approval in Admin → Timeline before
-- anything reaches the public Timeline. Additive only — nothing existing
-- changes, and the page stays closed until the host switches it on.

alter table public.events
  add column if not exists timeline_contributions_enabled boolean not null default false;

-- Who shared an extra milestone photo ("Shared by Priya"); null for the host's own.
alter table public.timeline_milestone_photos
  add column if not exists contributed_by text;

create table if not exists public.timeline_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invitee_id uuid references public.invitees(id) on delete set null,
  contributor_name text not null,
  -- The milestone the guest picked; null = "a memory that isn't on the timeline yet".
  milestone_id uuid references public.timeline_milestones(id) on delete set null,
  -- For a new memory: roughly when, and what it was.
  proposed_period text,
  proposed_title text,
  story text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists timeline_submissions_event_status_idx on public.timeline_submissions(event_id, status, created_at desc);
create index if not exists timeline_submissions_invitee_idx on public.timeline_submissions(invitee_id, status);

create table if not exists public.timeline_submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.timeline_submissions(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  original_name text,
  taken_at timestamp without time zone,
  lat double precision,
  lon double precision,
  fingerprint text,
  created_at timestamptz not null default now()
);
create index if not exists timeline_submission_photos_submission_idx on public.timeline_submission_photos(submission_id);

alter table public.timeline_submissions enable row level security;
alter table public.timeline_submission_photos enable row level security;
revoke all on public.timeline_submissions from anon, authenticated;
revoke all on public.timeline_submission_photos from anon, authenticated;
grant all on public.timeline_submissions to service_role;
grant all on public.timeline_submission_photos to service_role;
