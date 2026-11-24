-- Life Story — a written biography (web page + printable PDF book) and a
-- narrated AI film, built from a story the host uploads (.docx or pasted
-- text) and the photos they attach. One life story per event; the subject
-- defaults to the event's honoree. See services/life-story.ts and the
-- life-story Edge Function.
--
-- Same authorization model as the rest of the app: RLS on, no policies —
-- every read/write goes through the service role after an
-- requireAdminForEvent() check (or, for the public page, the share token).
--
-- Files live in the existing private buckets under `<event_id>/life-story/`:
--   gallery  — the attached photos (JPEG, compressed in the browser)
--   audio    — per-scene narration WAVs
--   videos   — Grok Imagine clips and the finished film MP4
-- services/media-access.ts lets an anonymous visitor read a file there only
-- while the story is shared and the file belongs to it.

create table public.life_stories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  subject_name text not null,
  title text not null default '',
  subtitle text not null default '',
  life_span text not null default '',
  story_text text not null default '',
  story_source text not null default 'paste' check (story_source in ('paste', 'docx')),
  narration_language text not null default 'english' check (narration_language in ('english', 'hindi', 'gujarati', 'hinglish')),
  music text not null default 'heartfelt' check (music in ('heartfelt', 'cinematic', 'celebration', 'none')),
  -- AI structuring (chapters + film script) runs in the background in the Edge Function.
  structure_status text not null default 'idle' check (structure_status in ('idle', 'processing', 'done', 'error')),
  structure_error text,
  structured_at timestamptz,
  cover_photo_id uuid,
  share_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  is_shared boolean not null default false,
  -- Client-role caps (the platform owner is exempt), same idea as
  -- events.guest_reel_render_limit. Raise per event with SQL if needed.
  structure_limit int not null default 5,
  structure_runs int not null default 0,
  film_render_limit int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.life_story_chapters (
  id uuid primary key default gen_random_uuid(),
  life_story_id uuid not null references public.life_stories (id) on delete cascade,
  sort_order int not null default 0,
  title text not null,
  period text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index life_story_chapters_story_idx on public.life_story_chapters (life_story_id, sort_order);

create table public.life_story_photos (
  id uuid primary key default gen_random_uuid(),
  life_story_id uuid not null references public.life_stories (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  chapter_id uuid references public.life_story_chapters (id) on delete set null,
  storage_path text not null unique,
  file_size bigint not null default 0,
  width int,
  height int,
  caption text not null default '',
  year_label text not null default '',
  ai_description text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index life_story_photos_story_idx on public.life_story_photos (life_story_id, sort_order);

alter table public.life_stories
  add constraint life_stories_cover_photo_fk foreign key (cover_photo_id) references public.life_story_photos (id) on delete set null;

create table public.life_story_scenes (
  id uuid primary key default gen_random_uuid(),
  life_story_id uuid not null references public.life_stories (id) on delete cascade,
  photo_id uuid references public.life_story_photos (id) on delete set null,
  sort_order int not null default 0,
  narration text not null default '',
  caption text not null default '',
  motion text not null default 'zoom_in' check (motion in ('zoom_in', 'zoom_out', 'pan_left', 'pan_right')),
  -- true = bring the photo to life with Grok Imagine (xAI) image-to-video.
  animate boolean not null default false,
  animation_prompt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index life_story_scenes_story_idx on public.life_story_scenes (life_story_id, sort_order);

-- One row per "Make the film" click. Scenes are SNAPSHOTTED into
-- life_story_render_scenes at start, so editing the script mid-render
-- can't corrupt a render in flight. State machine (Edge Function):
--   preparing → animating → submitting → rendering → done | error
create table public.life_story_renders (
  id uuid primary key default gen_random_uuid(),
  life_story_id uuid not null references public.life_stories (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  admin_id uuid,
  status text not null default 'preparing'
    check (status in ('preparing', 'animating', 'submitting', 'rendering', 'done', 'error')),
  progress_note text not null default '',
  music text not null default 'heartfelt',
  shotstack_render_id text,
  result_path text,
  duration_seconds numeric,
  xai_cost_usd numeric not null default 0,
  error_message text,
  -- film_tick claims this before doing slow work (copying clips/the film) in
  -- the background, so overlapping polls don't repeat it.
  tick_lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index life_story_renders_story_idx on public.life_story_renders (life_story_id, created_at desc);

create table public.life_story_render_scenes (
  id uuid primary key default gen_random_uuid(),
  render_id uuid not null references public.life_story_renders (id) on delete cascade,
  sort_order int not null,
  photo_path text,
  photo_width int,
  photo_height int,
  narration text not null default '',
  caption text not null default '',
  motion text not null default 'zoom_in',
  animate boolean not null default false,
  animation_prompt text not null default '',
  narration_path text,
  narration_seconds numeric,
  xai_request_id text,
  -- none = pan/zoom only; pending = waiting on Grok; ready = clip stored;
  -- fallback = Grok failed or was moderated → this scene uses pan/zoom instead.
  clip_status text not null default 'none' check (clip_status in ('none', 'pending', 'ready', 'fallback')),
  clip_path text,
  clip_seconds numeric,
  clip_error text
);
create index life_story_render_scenes_render_idx on public.life_story_render_scenes (render_id, sort_order);

alter table public.life_stories enable row level security;
alter table public.life_story_chapters enable row level security;
alter table public.life_story_photos enable row level security;
alter table public.life_story_scenes enable row level security;
alter table public.life_story_renders enable row level security;
alter table public.life_story_render_scenes enable row level security;
