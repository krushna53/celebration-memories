-- ============================================================================
-- Celebration Memories — Platform feature/marketing video (owner setting)
--
-- A single owner-editable video shown in a "See It In Action" section on
-- the platform marketing homepage (features/platform/platform-marketing-
-- content.tsx), between the hero CTAs and the "Everything You Need To
-- Host" features grid. Not per-event — this is the platform's own
-- promotional video, distinct from an event's hero background video
-- (the "hero" Storage bucket) or a guest's uploaded memory video.
--
-- Singleton table (id is always 'default', enforced by application code
-- always upserting that one row — no DB-level singleton constraint, same
-- lightweight approach as pricing_plan_settings). The owner can either:
--   - source_type = 'link': paste any URL (YouTube, Vimeo, or a direct
--     file link) — see lib/feature-video.ts for how that's turned into
--     an embeddable form.
--   - source_type = 'upload': upload an MP4/MOV file directly, stored in
--     the existing "videos" Storage bucket under a platform/ prefix
--     (mirrors the platform/payment-qr, platform/testimonials prefixes
--     already used in services/uploads.ts for other owner-uploaded,
--     non-event-scoped assets — those live in the "gallery" bucket since
--     they're images; this is a video so it uses "videos" instead).
--
-- RLS: enabled, no public policies — same posture as every other table.
-- The public homepage reads this through a Server Component using the
-- service-role client (supabaseAdmin()), same as everything else that
-- isn't guest/invitee-scoped.
-- ============================================================================

create table platform_video_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  source_type text not null default 'link' check (source_type in ('link', 'upload')),
  -- For source_type = 'link': the raw URL the owner pasted (YouTube/
  -- Vimeo/direct file link). For source_type = 'upload': the public
  -- Storage URL of the uploaded file.
  video_url text,
  -- Only set for source_type = 'upload' — the Storage object path, kept
  -- so a replace/remove can delete the old file instead of orphaning it.
  storage_path text,
  title text,
  updated_at timestamptz not null default now()
);

alter table platform_video_settings enable row level security;

insert into platform_video_settings (id, enabled, source_type)
values ('default', false, 'link')
on conflict (id) do nothing;
