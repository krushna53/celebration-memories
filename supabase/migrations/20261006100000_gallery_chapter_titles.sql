-- Per-event names for the gallery's chapters ("The little ones" → "Aarav &
-- Myra", "The wedding" → "Our big day"). Keyed by the stored category
-- value: { "grandchildren": "Aarav & Myra", "wedding": "Our big day" }.
-- Missing keys fall back to the default titles in
-- features/gallery/gallery-shared.tsx. Validated in application code
-- (services/events.ts → sanitizeGalleryChapterTitles).

alter table public.events
  add column if not exists gallery_chapter_titles jsonb;
