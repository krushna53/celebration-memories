-- Daily dispatch for the three cron-driven admin notification
-- producers (feature nudges, post-event "new plans" prompts, storage
-- warnings) — calls the Next.js app directly (not a Supabase Edge
-- Function), since app/api/cron/admin-notifications/route.ts reuses
-- existing Next-side services. Runs 5 minutes after the guest reminder
-- jobs (13:35 vs 13:30 UTC) purely to spread load, no functional
-- reason. Authenticated with CRON_SECRET (a random secret, NOT the
-- anon key this time — this hits application code with real database
-- side effects, not a Supabase Edge Function behind verify_jwt).
--
-- If CRON_SECRET is ever rotated, re-run this cron.schedule() call
-- (upserts by job name) with the new value — must match
-- CRON_SECRET set in Netlify's env vars exactly.
--
-- Applied live via MCP first per this repo's established practice;
-- this file is the matching committed source of truth.
select cron.schedule(
  'admin-notifications-dispatch',
  '35 13 * * *',
  $$
  select net.http_post(
    url := 'https://everymoment.in/api/cron/admin-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 0c0673ef783227f6272ecd06e037b349343a5ec8a8d2d33a38ebf84f4ccdae36'
    ),
    body := '{}'::jsonb
  );
  $$
);
