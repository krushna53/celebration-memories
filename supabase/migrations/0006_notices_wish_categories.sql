-- ============================================================================
-- Celebration Memories — event notices, wish message, and new categories
--
-- additional_notes: short free-text notices the host adds in Event
-- Settings ("No gifts please", "Dress code: formal", etc), shown as a
-- small block in the Event Details section.
--
-- wish_message: a free-text message shown in its own section on the
-- public event page, below RSVP by default (see lib/section-registry.ts
-- "wishMessage" key) — copy/heading adapts to the event's category (see
-- lib/event-category.ts), so the same field works for a birthday wish,
-- a wedding well-wish, a note of remembrance for an obituary/memorial
-- event, or event notes for a workshop/educational/live-stream event.
--
-- New categories broaden the platform past birthdays/weddings/etc to
-- also cover memorial services, workshops, educational events, and
-- live-streamed events — each gets its own section copy and, longer
-- term, its own template defaults.
-- ============================================================================

alter table events add column additional_notes text;
alter table events add column wish_message text;

alter type event_category add value 'obituary';
alter type event_category add value 'workshop';
alter type event_category add value 'education';
alter type event_category add value 'live_stream';
