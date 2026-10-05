-- "Start time only" events and per-event template colour tweaks.
--
-- has_end_time: false when the host only gave a start time — the site then
-- shows "7:00 PM onwards" instead of a range (lib/timezone.ts's
-- formatEventTimeRange). end_at stays NOT NULL and is still written (start +
-- a default duration) so every "has the event ended?" check keeps working.
--
-- theme_overrides: host-chosen colours layered on the selected template —
-- { accentColor?, highlightStyle?, highlightColor? }. Validated in
-- application code (lib/template-theme-vars.ts's sanitizeThemeOverrides).

alter table public.events
  add column if not exists has_end_time boolean not null default true,
  add column if not exists theme_overrides jsonb;
