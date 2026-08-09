-- Daily dispatch for the second reminder type (send-memory-nudge-push)
-- — same 7:00 PM IST slot as guest-reminder-push-dispatch
-- (0024_guest_reminder_cron.sql), kept as a separate cron job (rather
-- than one job calling both functions) so either can be paused/
-- rescheduled independently later without editing SQL, and so a
-- failure in one doesn't affect the other. Applied live via MCP first
-- per this repo's established practice; this file is the matching
-- committed source of truth.
select cron.schedule(
  'guest-memory-nudge-dispatch',
  '30 13 * * *',
  $$
  select net.http_post(
    url := 'https://ktbpnjrovzhjwardyime.supabase.co/functions/v1/send-memory-nudge-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0YnBuanJvdnpoandhcmR5aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMzcyMzMsImV4cCI6MjEwMDYxMzIzM30.Z-5NRVBQq3cVL6CXpBqUsXnPhgSLOj6CLDGKT0tb8JE'
    ),
    body := '{}'::jsonb
  );
  $$
);
