-- Private events: which Gallery photos anonymous visitors may see.
--
-- On an event with visibility = 'private', a visitor who isn't signed in
-- and didn't arrive through their own invite link sees only:
--   * each Timeline milestone's cover photo (never its extra photos), and
--   * Gallery photos with is_public = true.
-- Everyone else (signed-in viewers, invited guests, the event's team)
-- sees everything. Public events are unaffected by this flag.
-- Enforced in services/event-access.ts (seesPrivatePhotos) for both the
-- page data and the /media proxy (services/media-access.ts).
--
-- Default true so existing galleries look exactly as before until the
-- host marks photos "Guests only" in /admin/gallery.

alter table public.gallery_photos
  add column if not exists is_public boolean not null default true;
