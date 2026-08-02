-- Adds "Makeup Artists" as a top-level marketplace category, matching
-- the existing Photography category's structure (top-level + several
-- subcategories) so Makeup Artist vendors get the same browsing/filter
-- experience as Photographers already do.
--
-- Photographer and Magician categories already exist (Photographer as
-- its own top-level category with 8 subcategories; Magician as a
-- subcategory under Entertainment) — confirmed via the live project's
-- marketplace_categories table, seeded originally by
-- scripts/seed-marketplace-demo.mjs rather than a migration file (see
-- that gap noted in services/marketplace-categories.ts's usage — the
-- marketplace_categories/business_profiles table family was created
-- directly against the live project via MCP in an earlier session, not
-- checked into supabase/migrations). This file is deliberately a real
-- migration (not another live-only MCP-applied change) to start closing
-- that gap for at least this table going forward.
--
-- sort_order 5 continues directly after Entertainment (4) — see
-- services/marketplace-categories.ts for how sort_order drives display
-- order on the public /discover directory.

insert into marketplace_categories (slug, name, parent_id, description, icon, sort_order, is_active)
values
  ('makeup-artists', 'Makeup Artists', null, 'Bridal, party, and editorial makeup artists for every occasion.', 'Sparkles', 5, true);

insert into marketplace_categories (slug, name, parent_id, description, icon, sort_order, is_active)
select 'bridal-makeup', 'Bridal Makeup', id, 'Full bridal makeup and hairstyling packages.', 'Crown', 1, true
from marketplace_categories where slug = 'makeup-artists'
union all
select 'party-makeup', 'Party Makeup', id, 'Makeup for birthdays, receptions, and other celebrations.', 'PartyPopper', 2, true
from marketplace_categories where slug = 'makeup-artists'
union all
select 'hd-airbrush-makeup', 'HD & Airbrush Makeup', id, 'High-definition and airbrush makeup for camera-ready looks.', 'Wand2', 3, true
from marketplace_categories where slug = 'makeup-artists'
union all
select 'editorial-makeup', 'Editorial & Photoshoot Makeup', id, 'Makeup for photoshoots, portfolios, and editorial work.', 'Camera', 4, true
from marketplace_categories where slug = 'makeup-artists';
