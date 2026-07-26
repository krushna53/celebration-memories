-- ============================================================================
-- Celebration Memories — optional link-preview video (og:video)
--
-- Adds a slot for a short preview video, separate from the existing
-- share_image_path. NOT a replacement for the link-preview image: most
-- platforms (WhatsApp, Facebook, Messenger — anything on Meta's shared
-- crawler infrastructure) ignore og:video entirely and only ever render
-- og:image. Telegram is the notable exception that renders og:video as
-- an inline-playable preview, which is the actual reason this exists.
-- og:image should always stay configured as the universal fallback.
-- ============================================================================

alter table events add column if not exists share_video_path text;
