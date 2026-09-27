-- Gallery storytelling additions (2026-09-27):
--
-- 1. gallery_pairs — "Then & Now": the host pairs an old gallery photo
--    with a recent one; the public gallery shows them as a drag-to-compare
--    slider. Deleting either photo removes the pair.
-- 2. gallery_photos.original_storage_path — set when a scanned print is
--    cleaned up (cropped/enhanced). storage_path then points at the
--    cleaned copy and this keeps the untouched original so "Revert" can
--    always restore it. NULL = never cleaned.
--
-- Like every other table here: RLS on with no public policies — all
-- access goes through the service-role client in Server Actions.

create table if not exists gallery_pairs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  then_photo_id uuid not null references gallery_photos(id) on delete cascade,
  now_photo_id uuid not null references gallery_photos(id) on delete cascade,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint gallery_pairs_distinct_photos check (then_photo_id <> now_photo_id)
);

create index if not exists gallery_pairs_event_idx on gallery_pairs (event_id, sort_order);

alter table gallery_pairs enable row level security;

alter table gallery_photos add column if not exists original_storage_path text;
