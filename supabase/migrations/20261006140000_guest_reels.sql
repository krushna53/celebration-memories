-- Personalised Guest Reels: after the event, every guest who opted in
-- gets a short 9:16 video (Instagram Reel / WhatsApp Status sized) of
-- the photos they appear in with the guest of honour.
--
-- Consent model: a face photo is only ever stored WITH a consent
-- timestamp. Guests give it themselves (RSVP form, or the after-event
-- invite page); a host adding a guest's photo must confirm the guest
-- agreed (reel_consent_source = 'host'); the guest-of-honour photo is
-- set in Event Settings with its own confirmation. Removing a photo
-- clears consent and every face match for that person.
--
-- Face matching runs in the host's browser (features/admin/reels/
-- face-matcher.ts) — only match results (who appears in which photo,
-- plus the face box for framing) are stored, never face descriptors.

alter table events
  add column if not exists guest_reels_enabled boolean not null default false,
  add column if not exists reel_honoree_photo_path text,
  add column if not exists reel_honoree_consent_at timestamptz,
  add column if not exists reel_music text not null default 'celebration',
  add column if not exists guest_reel_render_limit integer not null default 60;

alter table invitees
  add column if not exists reel_photo_path text,
  add column if not exists reel_consent_at timestamptz,
  add column if not exists reel_consent_source text check (reel_consent_source in ('guest', 'host'));

-- Photos from the day, uploaded after the event by the host (e.g. the
-- photographer's set) or by guests. Feed for reels only — they are not
-- shown on the public Memory Wall.
create table if not exists event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  invitee_id uuid references invitees (id) on delete set null,
  storage_path text not null,
  uploaded_by text not null check (uploaded_by in ('host', 'guest')),
  created_at timestamptz not null default now()
);
create index if not exists event_photos_event_idx on event_photos (event_id, created_at desc);

-- One row per photo the face scanner has looked at. `source` says which
-- table the photo lives in: 'event' = event_photos, 'memory' = guest
-- Memory Wall photos (table photos, approved ones only).
create table if not exists reel_photo_scans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  source text not null check (source in ('event', 'memory')),
  source_id uuid not null,
  storage_path text not null,
  width integer not null,
  height integer not null,
  face_count integer not null default 0,
  scanned_at timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists reel_photo_scans_event_idx on reel_photo_scans (event_id);

-- Who was recognised in a scanned photo. invitee_id null + is_honoree =
-- the guest of honour. Box is normalised 0..1 (x, y, w, h) — used to
-- frame the 9:16 crop around the faces.
create table if not exists reel_photo_faces (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references reel_photo_scans (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  invitee_id uuid references invitees (id) on delete cascade,
  is_honoree boolean not null default false,
  distance real not null,
  box jsonb not null,
  check (is_honoree or invitee_id is not null)
);
create index if not exists reel_photo_faces_event_idx on reel_photo_faces (event_id, invitee_id);

-- One reel per guest; regenerating reuses the row (render_count keeps
-- the running total for the per-event quota and cost reporting).
create table if not exists guest_reels (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  invitee_id uuid not null unique references invitees (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'error')),
  edit jsonb not null,
  duration_seconds real not null default 0,
  photo_count integer not null default 0,
  shotstack_render_id text,
  result_path text,
  share_token text not null unique,
  error_message text,
  render_count integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guest_reels_event_idx on guest_reels (event_id);

alter table event_photos enable row level security;
alter table reel_photo_scans enable row level security;
alter table reel_photo_faces enable row level security;
alter table guest_reels enable row level security;
