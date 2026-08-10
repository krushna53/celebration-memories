-- Multi-select "Share Collection" links (#83) — lets an admin pick
-- several Media Library items (any mix of Gallery/Memory Wall/AI
-- Image/Slideshow/Video Edit) and get one bundled, no-OAuth shareable
-- link (/share/[token]) instead of sharing each item one at a time
-- (see task #80's per-item /p/[kind]/[id] page for that narrower case).
--
-- RLS is enabled with no public policies, matching every other table in
-- this project — authorization is enforced in application code
-- (Server Actions/services), not database-level policies; see
-- CLAUDE.md's "Core conventions" section.
--
-- share_collection_items stores a bare (kind, item_id) pair rather than
-- a foreign key into any specific media table, since it deliberately
-- spans seven different tables (gallery_photos, photos, videos, audio,
-- ai_image_jobs, slideshow_video_jobs, video_edit_jobs) — the public
-- page re-resolves each item fresh from its real table at render time
-- (services/share-collections.ts), so a deleted/trashed item quietly
-- drops out of the collection instead of 404ing the whole page.
create table if not exists public.share_collections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  token text not null unique,
  title text,
  created_by uuid references public.admins (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.share_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.share_collections (id) on delete cascade,
  kind text not null check (kind in ('gallery','photo','video','audio','ai_image','slideshow_video','video_edit')),
  item_id uuid not null,
  sort_order int not null default 0
);

create index if not exists share_collections_token_idx on public.share_collections (token);
create index if not exists share_collection_items_collection_idx on public.share_collection_items (collection_id);

alter table public.share_collections enable row level security;
alter table public.share_collection_items enable row level security;
