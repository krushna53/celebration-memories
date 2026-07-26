-- ============================================================================
-- Celebration Memories — Admin feature tour
--
-- Tracks whether an admin has already seen the interactive dashboard
-- walkthrough (features/admin/tour/*), so it only auto-plays once per
-- admin, on their first sign-in, rather than on every login. The admin
-- can always replay it manually via the "Take the Tour" button, which
-- doesn't touch this column at all.
-- ============================================================================

alter table admins add column if not exists has_seen_tour boolean not null default false;
