-- Instagram posts shared as memories (2026-09-27).
--
-- Guests paste a link to a PUBLIC Instagram post/reel; we store only the
-- canonical permalink and render it with Instagram's own embed on the
-- memory wall. No media is copied — Instagram's API no longer allows
-- reading personal accounts' media (Basic Display API, shut down Dec
-- 2024), and a link embed keeps the creator's post, likes and credit
-- intact. Same moderation as every other memory: approved = false until
-- the host approves it.
--
-- Like guestbook (text, no stored file) there's no deleted_at /
-- Recycle Bin — removing one is a plain delete. RLS on, no public
-- policies: access goes through service-role Server Actions.

create table if not exists instagram_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  invitee_id uuid references invitees(id) on delete set null,
  permalink text not null,
  caption text,
  approved boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists instagram_posts_event_idx on instagram_posts (event_id, approved, sort_order);
create unique index if not exists instagram_posts_event_permalink_idx on instagram_posts (event_id, permalink);

alter table instagram_posts enable row level security;
