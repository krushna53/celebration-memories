-- ============================================================================
-- Celebration Memories — raise guest video upload limit to 1GB
--
-- Was 250MB (262144000 bytes, set in migration 0002). The application-
-- side limit lives in types/memory.ts's UPLOAD_LIMITS.video and is
-- enforced before a signed upload URL is even minted (services/
-- uploads.ts's createSignedMediaUpload) — but the Storage bucket has
-- its own independent file_size_limit enforced at the Storage layer
-- regardless of what application code checked, so both must move
-- together or a guest could pass the app-level check and still get
-- rejected by Storage on the actual upload.
-- ============================================================================

update storage.buckets set file_size_limit = 1073741824 where id = 'videos';
