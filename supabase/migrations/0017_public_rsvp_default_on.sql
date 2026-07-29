-- ============================================================================
-- Flip the default for events.public_rsvp_enabled from off to on.
--
-- Previously every new event (both self-serve wizard drafts and events
-- created directly by the owner) started with the shared/public RSVP
-- link turned off — hosts had to know to go flip it on in Event
-- Settings before it worked. New events should have it on by default so
-- a host who hasn't sent personal invite links yet can still collect
-- RSVPs immediately; hosts who prefer personal-link-only RSVP tracking
-- can still turn it off in Event Settings same as before.
--
-- Only changes the column default — does NOT touch existing rows, so
-- events that were already explicitly turned off (or left off) keep
-- their current value. This is a default for new inserts only.
-- ============================================================================

alter table events alter column public_rsvp_enabled set default true;
