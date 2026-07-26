-- ============================================================================
-- Celebration Memories — AI-generated Custom CSS
--
-- Lets a client describe a style tweak in plain text and have OpenAI
-- (gpt-5.6-luna, same OPENAI_API_KEY as AI Image) write the CSS instead
-- of hand-typing it. Deliberately CSS-only output — see lib/ai-css.ts
-- and lib/custom-css.ts — every generation is run through the same
-- validateCustomCss() blocklist as hand-written Custom CSS before it's
-- ever shown to the admin, so the "no JS, no url(), no @import" safety
-- guarantee holds regardless of what the model produces.
--
-- Mirrors ai_image_generations/ai_image_generation_limit exactly, just
-- for this feature — text generation is far cheaper per-call than image
-- generation, hence the higher default limit (20 vs 5).
-- ============================================================================

create table ai_css_generations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  admin_id uuid not null references admins (id) on delete cascade,
  prompt text not null,
  created_at timestamptz not null default now()
);

create index ai_css_generations_event_idx on ai_css_generations (event_id);

alter table ai_css_generations enable row level security;

alter table events add column if not exists ai_css_generation_limit integer not null default 20;
