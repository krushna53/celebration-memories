-- Daily dispatch for the second reminder type (send-memory-nudge-push)
-- — same 7:00 PM IST slot as guest-reminder-push-dispatch
-- (0024_guest_reminder_cron.sql), kept as a separate cron job (rather
-- than one job calling both functions) so either can be paused/
-- rescheduled independently later without editing SQL, and so a
-- failure in one doesn't affect the other. Applied live via MCP first
-- per this repo's established practice; this file is the matching
-- committed source of truth.
--
-- REDACTED BELOW: <SUPABASE_URL> / <SUPABASE_ANON_KEY> are placeholders
-- — see 0024_guest_reminder_cron.sql's header comment for why (Netlify
-- secret scanning blocks a build with either literal value present
-- anywhere in the repo). Real values already applied live.
select cron.schedule(
  'guest-memory-nudge-dispatch',
  '30 13 * * *',
  $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/send-memory-nudge-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
