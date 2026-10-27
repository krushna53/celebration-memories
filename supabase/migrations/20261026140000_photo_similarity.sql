-- Duplicate and look-alike photos.
--
-- phash: a 64-bit perceptual "difference hash" (16 hex chars) of the
-- stored image, computed server-side with sharp (services/photo-hashes.ts).
-- Two photos whose hashes differ in only a few bits look the same — a
-- WhatsApp re-send, a resized copy, a burst shot — and the Big Screen
-- Display shows just the first of each such group (lib/photo-similarity.ts).
-- '-' marks a file that couldn't be hashed (e.g. HEIC), so it isn't retried.
-- Filled in the background from /admin/timeline for existing photos.
--
-- gallery_photos.fingerprint: same identity as the Timeline's
-- (features/admin/timeline/photo-import.ts → photoFingerprint), so an
-- identical photo is skipped before it is uploaded to the Gallery twice.
--
-- All nullable and purely additive; older code ignores them.

alter table public.gallery_photos
  add column if not exists fingerprint text,
  add column if not exists phash text;

alter table public.timeline_milestones
  add column if not exists image_phash text;

alter table public.timeline_milestone_photos
  add column if not exists phash text;
