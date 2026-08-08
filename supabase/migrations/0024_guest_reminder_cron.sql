-- Guest reminder system, phase 2: automatic dispatch via pg_cron + pg_net.
-- Applied directly against the live project via MCP first (see 0022/
-- 0023's header comments for why), this is the matching committed
-- source of truth.
--
-- Once a day (13:30 UTC = 7:00 PM IST/Asia/Kolkata — this app's events
-- are India-based; adjust the schedule below if that stops being true),
-- calls supabase/functions/send-reminder-push with no body, which
-- processes every event with guest_reminder_enabled = true and sends a
-- Web Push reminder to any guest who started recording/uploading a
-- video or audio memory but never finished (see that function's own
-- header comment for the full targeting logic). Was every 15 minutes
-- initially; changed to once daily since a family/wedding guest list
-- doesn't need near-real-time reminders and a single daily nudge reads
-- as less spammy.
--
-- The Authorization header below is the project's anon key — a validly
-- signed project JWT, already public (it's the same value as
-- NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.example). This only clears the
-- Edge Function's verify_jwt gate; the function does all its real work
-- with its own service-role key internally, so this is not an
-- authorization boundary. If the anon key is ever rotated, re-run
-- `select cron.alter_job(job_id, command := ...)` (or re-apply this
-- file's cron.schedule call, which upserts by job name) with the new
-- key — find the current key at Project Settings -> API.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'guest-reminder-push-dispatch',
  '30 13 * * *',
  $$
  select net.http_post(
    url := 'https://ktbpnjrovzhjwardyime.supabase.co/functions/v1/send-reminder-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0YnBuanJvdnpoandhcmR5aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMzcyMzMsImV4cCI6MjEwMDYxMzIzM30.Z-5NRVBQq3cVL6CXpBqUsXnPhgSLOj6CLDGKT0tb8JE'
    ),
    body := '{}'::jsonb
  );
  $$
);
