-- ============================================================================
-- Celebration Memories — optional photo per Timeline milestone
--
-- Timeline milestones previously had no image at all (period/title/
-- description only). Adds an optional image, uploaded per-milestone
-- from /admin/timeline, shown on the public Timeline section and
-- selectable as a slide in the Slideshow Video composer alongside
-- Gallery photos.
-- ============================================================================

alter table timeline_milestones add column if not exists image_path text;
