-- ============================================================================
-- Celebration Memories — server-side Slideshow Video rendering
--
-- The Slideshow Video tool used to render entirely in the browser via
-- <canvas> + MediaRecorder (see the now-removed hooks/use-slideshow
-- -recorder.ts) — free, but WebM-only, download-only, and with no text
-- overlays. This replaces that with real server-side rendering through
-- Shotstack (https://shotstack.io), a video-editing API: a Supabase Edge
-- Function submits a JSON timeline (photos + optional caption bars +
-- optional soundtrack) to Shotstack, which renders a real MP4 on its own
-- infrastructure and hands back a URL once done.
--
-- Unlike AI Image (supabase/functions/generate-ai-image), this can't be
-- one synchronous Edge Function call — Shotstack renders are async by
-- design (the initial request just queues a render and returns an id;
-- actual rendering can take anywhere from ~10s to a couple of minutes).
-- So this is a two-function, poll-based flow:
--   1. generate-slideshow-video — submits the render, stores the
--      Shotstack render id here, returns immediately.
--   2. slideshow-video-status — the browser polls this every few
--      seconds; once Shotstack reports the render done, this function
--      downloads the finished MP4 and re-uploads it into our own
--      Storage (gallery bucket, slideshow-video/ prefix) so the result
--      is ours to keep regardless of how long Shotstack retains it.
-- See features/admin/slideshow/slideshow-composer.tsx and the README's
-- "Slideshow Video" section for the full flow.
-- ============================================================================

create table slideshow_video_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'rendering', 'done', 'error')),
  shotstack_render_id text,
  result_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index slideshow_video_jobs_status_idx on slideshow_video_jobs (status);

alter table slideshow_video_jobs enable row level security;

-- Checked exclusively via the service-role client (both the Next.js app
-- and the Edge Functions use the service role key directly) — no public
-- policy needed or wanted here, same as ai_image_jobs.

-- Mirrors ai_image_generations exactly, just for this feature — one row
-- per successfully *completed* render, used purely for the per-event
-- quota check (client-role admins only; owner is exempt). Deliberately
-- separate from slideshow_video_jobs so failed/abandoned jobs don't
-- count against the quota.
create table slideshow_video_generations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index slideshow_video_generations_event_idx on slideshow_video_generations (event_id);

alter table slideshow_video_generations enable row level security;

-- Video rendering is billed per-minute by Shotstack, meaningfully more
-- expensive per generation than an AI Image call — hence a much lower
-- default cap than ai_image_generation_limit (5) or ai_css_generation
-- _limit (20).
alter table events add column if not exists slideshow_video_generation_limit integer not null default 3;
