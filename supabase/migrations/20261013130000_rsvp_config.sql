-- Configurable RSVP forms (lib/rsvp-config.ts): which built-in fields show,
-- which are required, custom labels/attendance wording, and the event's own
-- questions. Null = the original default form. Validated in application code.
alter table public.events add column if not exists rsvp_config jsonb;

-- Answers to an event's custom RSVP questions, keyed by question id.
alter table public.rsvps add column if not exists answers jsonb;
