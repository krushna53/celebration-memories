-- Adds "Reunion" (family/school/college reunions) as a new event
-- category — same pattern as 0006_notices_wish_categories.sql, which
-- added obituary/workshop/education/live_stream to this enum after
-- initial launch. New enum values are additive and don't touch any
-- existing row (default stays 'birthday').
alter type event_category add value 'reunion';
