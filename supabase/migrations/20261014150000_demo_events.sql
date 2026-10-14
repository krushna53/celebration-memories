-- Sample events shown publicly (e.g. shared on LinkedIn) to let people see
-- what EveryMoment builds. A demo event shows a "This is a sample event —
-- create your own" strip under its hero (features/event-landing/demo-event-strip.tsx).
alter table public.events add column if not exists is_demo boolean not null default false;
