-- Recycle Bin for guest/admin media — soft-delete instead of an
-- immediate hard delete, so a client (or the owner) can undo an
-- accidental delete for up to 30 days before it's permanently purged.
--
-- Scope: gallery_photos, photos, videos, audio — the four tables that
-- hold an actual Storage object per row. guestbook is deliberately
-- excluded (it's text, not media — see the client's original request
-- "recycle bin ... for media").
--
-- deleted_at is nullable; null means "not trashed" (the normal state).
-- Every existing read query across the app (Gallery, Memory Wall,
-- Memories moderation queue, the /p/[kind]/[id] public share page, the
-- Video Editor's media bin) is updated in application code to add
-- `.is("deleted_at", null)` so a trashed item disappears from every
-- normal listing immediately, while still existing in the table for
-- the Recycle Bin admin page to list/restore/purge.
--
-- Partial indexes (where deleted_at is not null) keep both the
-- Recycle Bin listing query and the daily purge sweep's cutoff query
-- fast without bloating the far more common "not trashed" scans.
alter table public.gallery_photos add column if not exists deleted_at timestamptz;
alter table public.photos add column if not exists deleted_at timestamptz;
alter table public.videos add column if not exists deleted_at timestamptz;
alter table public.audio add column if not exists deleted_at timestamptz;

create index if not exists gallery_photos_deleted_at_idx on public.gallery_photos (deleted_at) where deleted_at is not null;
create index if not exists photos_deleted_at_idx on public.photos (deleted_at) where deleted_at is not null;
create index if not exists videos_deleted_at_idx on public.videos (deleted_at) where deleted_at is not null;
create index if not exists audio_deleted_at_idx on public.audio (deleted_at) where deleted_at is not null;
