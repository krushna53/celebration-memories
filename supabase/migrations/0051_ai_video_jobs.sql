-- Prompt-to-video jobs are intentionally asynchronous: OpenAI returns a
-- queued Sora job and the application polls until its MP4 is ready.
create table if not exists ai_video_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  prompt text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'error')),
  openai_video_id text,
  result_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_video_jobs_event_status_idx on ai_video_jobs (event_id, status);
alter table ai_video_jobs enable row level security;

create table if not exists ai_video_generations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_video_generations_event_idx on ai_video_generations (event_id);
alter table ai_video_generations enable row level security;

-- Client admins are capped because Sora generation is a paid API call.
alter table events add column if not exists ai_video_generation_limit integer not null default 2;
