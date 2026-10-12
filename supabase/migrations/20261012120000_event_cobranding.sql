-- Co-branding for agency-run events ("Powered by CorpCrew"), shown as a
-- small line on the event site and invite page. Both optional; null =
-- nothing shown. Written only by services/event-cobrand.ts (validated
-- there), so no RLS change: events already has no public policies.
alter table public.events
  add column if not exists cobrand_name text,
  add column if not exists cobrand_url text;

alter table public.events
  add constraint events_cobrand_name_length check (cobrand_name is null or char_length(cobrand_name) <= 60),
  add constraint events_cobrand_url_format check (cobrand_url is null or (char_length(cobrand_url) <= 200 and cobrand_url ~ '^https?://'));
