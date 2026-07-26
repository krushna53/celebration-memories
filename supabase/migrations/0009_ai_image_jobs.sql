-- ============================================================================
-- Celebration Memories — async AI Image generation jobs
--
-- Netlify's free plan caps a normal (synchronous) function at 10 seconds,
-- but OpenAI image generation routinely takes longer than that,
-- producing a 502 when called directly from a Server Action. The fix:
-- the Server Action now only creates a row here and triggers a Netlify
-- *Background Function* (up to 15 minutes, still free-plan compatible)
-- to do the actual OpenAI call + Storage upload; the browser polls this
-- table's status via getAiImageJobStatusAction until it's done.
-- See netlify/functions/generate-ai-image-background.mts and
-- features/admin/ai-image/actions.ts.
-- ============================================================================

create table ai_image_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  prompt text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  result_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_image_jobs_status_idx on ai_image_jobs (status);

alter table ai_image_jobs enable row level security;

-- Checked exclusively via the service-role client (both the Next.js app
-- and the standalone Netlify Background Function use the service role
-- key directly) — no public policy needed or wanted here.
