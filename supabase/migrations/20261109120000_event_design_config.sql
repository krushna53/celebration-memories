-- The full design a host made on a design-first template's create page
-- (today: Sacred Garden at /wedding-websites/create). One string per form
-- field; uploaded pictures, video and music are stored in Storage and kept
-- here as "media:<bucket>/<path>" refs (features/sacred-garden/lib/design.ts).
-- Null for every other event.
alter table public.events add column if not exists design_config jsonb;
