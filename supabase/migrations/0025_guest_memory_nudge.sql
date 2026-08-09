-- Second, distinct reminder type: a one-time nudge to guests who
-- RSVP'd "coming" or "maybe" but haven't shared any memory yet,
-- encouraging them to before the event. Separate from
-- guest_reminder_enabled (the abandoned-recording reminder from
-- 0023/0024) since the targeting/cadence logic is entirely different
-- (a days-before-event window, not a per-attempt delay) — see
-- supabase/functions/send-memory-nudge-push. Applied live via MCP
-- first per this repo's established practice; this file is the
-- matching committed source of truth.
alter table events add column if not exists share_memory_nudge_enabled boolean not null default true;
alter table events add column if not exists share_memory_nudge_days_before integer not null default 3;
