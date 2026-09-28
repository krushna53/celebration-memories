-- ============================================================================
-- Security hardening, part 2 — applied 2026-09-29, after the web app build
-- that serves signed /media/... links (lib/media-url.ts) and the updated
-- Edge Functions were live. Applying it earlier would have broken every
-- guest photo, video, voice note and gallery image on the site.
--
-- 1. Guest memories and the family gallery move to PRIVATE buckets. Until
--    now any copied Storage link worked forever for anyone; from here on
--    files are only reachable through short-lived signed links the app
--    hands to people who can already see the page. hero, avatars and
--    business stay public on purpose (event hero art, profile pictures and
--    vendor marketing images are meant to be shared).
--
-- 2. Supabase security advisor clean-ups:
--    - handle_new_confirmed_admin() gets a fixed, empty search_path so a
--      SECURITY DEFINER function can't be tricked by objects created in
--      another schema. Its body only references public.admins (fully
--      qualified) and built-ins, so nothing changes functionally.
--    - The unused `http` extension moves out of the API-exposed public
--      schema. Scheduled jobs use pg_net (net.http_post), not this
--      extension; nothing in the database calls it (checked 2026-09-28).
-- ============================================================================

update storage.buckets
set public = false
where id in ('photos', 'videos', 'audio', 'gallery');

alter function public.handle_new_confirmed_admin() set search_path = '';

