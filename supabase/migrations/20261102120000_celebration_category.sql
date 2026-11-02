-- Generic family occasion for anything that isn't a birthday, wedding etc.
-- — festivals (Diwali, Eid, Christmas…), house-warmings, get-togethers.
-- Offered on the wizard's Occasion step as "Festival / Other Celebration"
-- (lib/event-segment.ts). Family segment, like every non-corporate category.
alter type event_category add value if not exists 'celebration';
