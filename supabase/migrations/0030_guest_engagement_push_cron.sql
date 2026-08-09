-- Daily dispatch for the third guest push type (send-engagement-push:
-- countdown milestones + new-content digests) — same 7:00 PM IST slot
-- family as the other two guest reminder cron jobs (0024, 0026), kept
-- as its own job so it can be paused independently. Applied live via
-- MCP first per this repo's established practice; this file is the
-- matching committed source of truth.
--
-- REDACTED BELOW: <SUPABASE_URL> / <SUPABASE_ANON_KEY> are placeholders,
-- not the literal values — see 0024_guest_reminder_cron.sql's header
-- comment for why (Netlify secret scanning blocks a build with either
-- literal value present anywhere in the repo — this bit an earlier
-- deploy before it was caught). Real values already applied live.
select cron.schedule(
  'guest-engagement-push-dispatch',
  '32 13 * * *',
  $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/send-engagement-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
