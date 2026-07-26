-- ============================================================================
-- Celebration Memories — client-safe Custom CSS per event
--
-- Deliberately CSS-only, never JS — allowing a client (event host) to
-- inject arbitrary <script> would be a stored-XSS vector affecting every
-- guest who visits their event page, on a platform meant to be reused
-- across many customers. See lib/custom-css.ts for the validation rules
-- (rejects @import, url(), expression(), javascript:/vbscript: protocols,
-- and any literal "<" — the last blocks trying to smuggle a <script> tag
-- in through this field).
-- ============================================================================

alter table events add column if not exists custom_css text;
