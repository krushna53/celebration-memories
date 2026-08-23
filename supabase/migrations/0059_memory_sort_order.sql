-- 0059_memory_sort_order.sql
-- Adds sort_order to photos, videos, audio, and guestbook so admins can
-- reorder memories on the Memory Wall independently of upload time.
-- Default = 0 so all existing rows sit at the same order level and are
-- sub-sorted by created_at (which the service still uses as a tie-break).

alter table photos    add column if not exists sort_order integer not null default 0;
alter table videos    add column if not exists sort_order integer not null default 0;
alter table audio     add column if not exists sort_order integer not null default 0;
alter table guestbook add column if not exists sort_order integer not null default 0;

-- Index per table so ORDER BY sort_order, created_at is fast.
create index if not exists photos_sort_order_idx    on photos    (event_id, sort_order, created_at);
create index if not exists videos_sort_order_idx    on videos    (event_id, sort_order, created_at);
create index if not exists audio_sort_order_idx     on audio     (event_id, sort_order, created_at);
create index if not exists guestbook_sort_order_idx on guestbook (event_id, sort_order, created_at);
