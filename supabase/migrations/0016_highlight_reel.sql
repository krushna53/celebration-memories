-- ============================================================================
-- Celebration Memories — Big Screen Display highlight reel
--
-- Lets an admin upload a single, already-edited video (e.g. combined
-- from all the guest videos in an external tool, with name labels
-- burned in) to play as its own slide on the Big Screen Display —
-- the "bring your own compiled video" alternative to automatic
-- in-app clubbing, which isn't built yet. Same pattern as
-- share_video_path: one nullable Storage path, gallery bucket.
-- ============================================================================

alter table events add column if not exists highlight_reel_path text;
