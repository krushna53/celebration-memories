-- More than one photo per Timeline milestone, and remembering when/where
-- a milestone's photos were taken so a later zip import can add new
-- photos to the right milestone instead of creating a duplicate.
--
-- Purely additive: the milestone's existing single photo (image_path) is
-- untouched and stays its cover — every column below is nullable and only
-- filled by the photo import (features/admin/timeline/photo-timeline-import.tsx)
-- and the "Add more photos" button.

alter table public.timeline_milestones
  -- First / last day its photos were taken (camera local date).
  add column if not exists taken_from date,
  add column if not exists taken_to date,
  -- Where (first photo with GPS) + the reverse-geocoded name.
  add column if not exists lat double precision,
  add column if not exists lon double precision,
  add column if not exists place text,
  -- Fingerprint of the cover photo (photo-import.ts → photoFingerprint), so re-importing it is recognised.
  add column if not exists image_fingerprint text;

create table if not exists public.timeline_milestone_photos (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.timeline_milestones(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  original_name text,
  -- Camera local wall-clock time — no zone, same as EXIF.
  taken_at timestamp without time zone,
  lat double precision,
  lon double precision,
  -- Size + capture time (or content hash): the same photo imported again from another zip/account matches.
  fingerprint text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists timeline_milestone_photos_milestone_idx on public.timeline_milestone_photos(milestone_id, sort_order);
create index if not exists timeline_milestone_photos_event_fp_idx on public.timeline_milestone_photos(event_id, fingerprint);

alter table public.timeline_milestone_photos enable row level security;
revoke all on public.timeline_milestone_photos from anon, authenticated;
grant all on public.timeline_milestone_photos to service_role;
