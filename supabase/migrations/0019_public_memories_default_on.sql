-- ============================================================================
-- Celebration Memories — turn the public Memory Wall share link on by default
--
-- public_memories_enabled defaulted to false, same as public_rsvp_enabled
-- used to (see 0017_public_rsvp_default_on.sql) — the shareable
-- /events/[slug]/memories link had to be manually flipped on per event.
-- Per user request, this should be open to everyone by default for now.
-- Only touches already-active events; abandoned wizard drafts are left
-- alone since the flag is meaningless until an event actually launches.
-- ============================================================================

alter table events alter column public_memories_enabled set default true;
update events set public_memories_enabled = true where status = 'active';
