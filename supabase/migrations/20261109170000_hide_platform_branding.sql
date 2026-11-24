-- An event page without EveryMoment's own footer or "Install the app" prompt
-- (set per event by the platform owner, e.g. for a couple's wedding site).
alter table public.events
  add column if not exists hide_platform_branding boolean not null default false;
