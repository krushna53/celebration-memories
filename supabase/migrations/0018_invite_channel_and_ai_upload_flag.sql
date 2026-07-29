-- ============================================================================
-- Two small, unrelated additive columns bundled into one migration:
--
-- 1. invitees.invite_channel — optional, admin-set record of how a guest's
--    invite actually reached them (self-serve via the public web link,
--    manually via WhatsApp, a phone call, etc). Purely informational, no
--    application logic depends on it.
--
-- 2. ai_image_jobs.is_upload — distinguishes a real AI generation from a
--    manually-uploaded image using the same table for tracking, so the
--    "Upload Your Own" tab's result can be found again after a reload the
--    same way generations already are (see getLatestCompletedAiImageJob /
--    the new getLatestUploadedAiImage in services/ai-image-jobs.ts).
--    Existing rows default to false (they're all real generations).
-- ============================================================================

alter table invitees add column if not exists invite_channel text;

alter table ai_image_jobs add column if not exists is_upload boolean not null default false;
