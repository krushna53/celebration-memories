-- The main illustration cropped off the invitation card (services/card-artwork.ts),
-- shown under the hero on the event page. Path in the private `gallery` bucket.
alter table public.events add column if not exists card_artwork_path text;
