-- Seed data for local development / initial launch.
-- Safe to re-run: uses `on conflict do nothing` keyed on the unique slug.

insert into events (
  slug, category, honoree_name, event_title, hosted_by,
  start_at, end_at
) values (
  'mahesh-75th-birthday',
  'birthday',
  'Mahesh J. Shah',
  '75 Years of Love',
  'Jagruti Shah',
  '2026-08-23T11:00:00+05:30',
  '2026-08-23T15:00:00+05:30'
)
on conflict (slug) do nothing;
