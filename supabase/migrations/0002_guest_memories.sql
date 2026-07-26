-- ============================================================================
-- Celebration Memories — Phase 4 schema
-- Guest photo/video/audio uploads + guestbook, plus their Storage buckets.
--
-- Design notes:
--   * Same RLS posture as 0001: enabled, no public policies. All reads for
--     the public Memory Wall go through a Server Component using the
--     service-role client and filtering `approved = true` server-side —
--     the anon key can't query these tables directly.
--   * Storage buckets are public-read (so approved media renders via plain
--     <img>/<video src> URLs without a signed fetch on every page view),
--     but objects live under unguessable UUID paths and all writes go
--     through signed upload URLs minted server-side after validating the
--     guest's invite token — see lib/supabase/uploads.ts.
--   * `approved` defaults to false: every guest upload sits in a
--     moderation queue (Phase 5 admin dashboard) before it appears on the
--     public Memory Wall.
-- ============================================================================

create table photos (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid not null references invitees (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  caption text,
  storage_path text not null,
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid not null references invitees (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  caption text,
  storage_path text not null,
  thumbnail text,
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table audio (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid not null references invitees (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  caption text,
  storage_path text not null,
  duration integer, -- seconds
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table guestbook (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid not null references invitees (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  guest_name text not null,
  message text not null,
  country text,
  photo_storage_path text,
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index photos_event_approved_idx on photos (event_id, approved, created_at desc);
create index videos_event_approved_idx on videos (event_id, approved, created_at desc);
create index audio_event_approved_idx on audio (event_id, approved, created_at desc);
create index guestbook_event_approved_idx on guestbook (event_id, approved, created_at desc);

alter table photos enable row level security;
alter table videos enable row level security;
alter table audio enable row level security;
alter table guestbook enable row level security;

-- ----------------------------------------------------------------------------
-- Storage buckets
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', true, 52428800, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('videos', 'videos', true, 262144000, array['video/mp4','video/quicktime']),
  ('audio', 'audio', true, 26214400, array['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/webm']),
  ('hero', 'hero', true, 262144000, array['video/mp4','video/quicktime','image/jpeg','image/png','image/webp']),
  ('gallery', 'gallery', true, 52428800, array['image/jpeg','image/png','image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
