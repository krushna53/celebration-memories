-- ============================================================================
-- Celebration Memories — AI Timeline Movie (HeyGen-narrated highlight video)
--
-- A per-event admin feature: turn the event's Timeline milestones and
-- Gallery/Timeline photos into an AI-avatar-narrated highlight video via
-- HeyGen (https://heygen.com) — each selected Timeline entry becomes one
-- "scene": a HeyGen AI host reads that entry's title/description aloud,
-- with a matching photo as the scene's background image. Distinct from
-- the existing Slideshow Video (Shotstack, photos + music, no narration)
-- — this is a separate feature, not a replacement.
--
-- Same two-Edge-Function, poll-based design as Slideshow Video, since
-- HeyGen's video.generate is asynchronous the same way Shotstack's
-- render is (the submit call returns almost immediately with a video
-- id; actual rendering typically takes 1-5 minutes for a multi-scene
-- video):
--   1. generate-timeline-movie — builds the HeyGen video_inputs payload
--      from the milestones/photos the browser sends, submits it, stores
--      the returned heygen_video_id.
--   2. timeline-movie-status — polled every few seconds; once HeyGen
--      reports "completed", downloads the finished MP4 (HeyGen's URL
--      expires in 7 days) and re-uploads it into our own Storage
--      (videos bucket, timeline-movie/ prefix), then records a
--      completed generation for the per-event quota.
--
-- Also supports uploading a pre-made video directly instead of
-- generating one via HeyGen (source = 'upload') — those jobs skip
-- straight to 'done' with no HeyGen involvement and don't count against
-- the AI generation quota (see services/timeline-movie-jobs.ts).
-- ============================================================================

create table timeline_movie_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  source text not null default 'ai' check (source in ('ai', 'upload')),
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'error')),
  heygen_video_id text,
  result_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index timeline_movie_jobs_status_idx on timeline_movie_jobs (status);
create index timeline_movie_jobs_event_idx on timeline_movie_jobs (event_id);

alter table timeline_movie_jobs enable row level security;

-- Mirrors slideshow_video_generations exactly — one row per successfully
-- *completed* AI (HeyGen) render, used purely for the per-event quota
-- check (client-role admins only; owner is exempt). Uploads don't insert
-- here since they don't consume HeyGen credits.
create table timeline_movie_generations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index timeline_movie_generations_event_idx on timeline_movie_generations (event_id);

alter table timeline_movie_generations enable row level security;

-- HeyGen avatar video is billed per-second and meaningfully more
-- expensive per generation than Shotstack's slideshow rendering (see
-- README's "AI Timeline Movie" section for current per-minute cost
-- estimates) — hence a lower default cap than slideshow_video
-- _generation_limit (3).
alter table events add column if not exists timeline_movie_generation_limit integer not null default 2;
