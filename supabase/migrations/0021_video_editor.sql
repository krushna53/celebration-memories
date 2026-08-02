-- ============================================================================
-- EveryMoment — in-browser Video Editor (Shotstack Studio SDK)
--
-- A second, separate Shotstack-backed feature alongside Slideshow Video
-- (slideshow_video_jobs, migration 0014) — that one auto-arranges Gallery
-- photos into a video with zero manual control. This is the opposite: a
-- real drag-and-drop timeline editor (@shotstack/shotstack-studio,
-- https://shotstack.io/docs/guide/studio-sdk/) embedded in its own admin
-- page, where the client builds an edit by hand from all of an event's
-- photos/videos plus their own custom uploads, then renders it.
--
-- The Studio SDK only handles in-browser editing/preview — the actual
-- MP4 render still goes through Shotstack's async Edit API, same
-- submit-then-poll pattern as Slideshow Video (see that migration's
-- comment for why: renders aren't instant, so a single synchronous Edge
-- Function call won't do). Deliberately NOT reusing
-- generate-slideshow-video/slideshow-video-status — those two have
-- slideshow-specific JSON-building logic baked in; this feature gets its
-- own pair (render-video-edit / video-edit-status) that just passes
-- through whatever Edit JSON the Studio SDK produced
-- (edit.getEdit() — the same schema the Edit API renders directly).
-- ============================================================================

-- One row per saved edit. `edit_json` is the Studio SDK's Edit document
-- (see edit.getEdit()/edit.loadEdit() in the SDK docs) — saved on an
-- interval while the client works so a closed tab doesn't lose progress,
-- independent of whether it's ever rendered. A client can have several
-- of these per event (unlike slideshow_video_jobs' implicit "latest job
-- wins" pattern) — rendering costs real Shotstack credits, so people
-- should be able to keep and compare a few finished cuts rather than
-- being forced to overwrite the last one to try again.
create table video_edit_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  title text not null default 'Untitled edit',
  edit_json jsonb,
  status text not null default 'draft' check (status in ('draft', 'rendering', 'done', 'error')),
  shotstack_render_id text,
  result_path text,
  error_message text,
  -- At most one job per event is "live" on the Big Screen Display at a
  -- time — see the partial unique index below. Setting this copies
  -- result_path into events.highlight_reel_path (the same field the
  -- existing /events/[slug]/display page already reads, added in
  -- migration 0016), so the display page itself needs no changes.
  is_live_on_big_screen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_edit_jobs_event_idx on video_edit_jobs (event_id);
create index video_edit_jobs_status_idx on video_edit_jobs (status);

-- Enforces "at most one live job per event" at the database level rather
-- than trusting application code alone — a partial unique index (only
-- indexes rows where the flag is true) rather than a plain unique
-- constraint, since most rows will have is_live_on_big_screen = false.
create unique index video_edit_jobs_one_live_per_event_idx
  on video_edit_jobs (event_id)
  where is_live_on_big_screen;

alter table video_edit_jobs enable row level security;

-- Same quota-counting pattern as slideshow_video_generations (migration
-- 0014) — one row per completed render, counted against
-- events.video_editor_generation_limit for client-role admins only.
-- Kept separate from video_edit_jobs so drafts/failed renders don't
-- count against the quota.
create table video_edit_generations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index video_edit_generations_event_idx on video_edit_generations (event_id);

alter table video_edit_generations enable row level security;

-- Manual-editing renders are at least as expensive as Slideshow Video's
-- (same per-minute Shotstack billing), so the same conservative default
-- cap.
alter table events add column if not exists video_editor_generation_limit integer not null default 3;

-- Custom videos a client uploads specifically to edit with (e.g. a
-- separately-shot intro clip) — deliberately NOT the same table as the
-- guest-facing `videos` table (migration 0002), which carries an
-- approval/moderation lifecycle that doesn't apply to the admin's own
-- editing assets. These are always visible to the admin who owns the
-- event, never shown to guests or on the public Memory Wall.
create table video_editor_uploads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  storage_path text not null,
  filename text,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

create index video_editor_uploads_event_idx on video_editor_uploads (event_id);

alter table video_editor_uploads enable row level security;

-- All four tables above: checked exclusively via the service-role client
-- (supabaseAdmin()), same as every other admin-only table in this
-- schema — no public RLS policy needed or wanted.
