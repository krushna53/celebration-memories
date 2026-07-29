-- ============================================================================
-- Celebration Memories — public "share a memory" link for relatives
--
-- Mirrors public_rsvp_enabled: off by default, opt-in per event. When on,
-- /events/[slug]/memories is reachable by anyone with the link (no invite
-- token needed) so a host can hand out one link to every relative instead
-- of a personal /invite/[token] link each. Visitors identify themselves by
-- name only (see services/public-memories.ts), which mints a normal
-- invitee row + token behind the scenes so uploads flow through the exact
-- same moderation queue and Memory Wall as token-based guest uploads.
-- ============================================================================

alter table events add column if not exists public_memories_enabled boolean not null default false;
