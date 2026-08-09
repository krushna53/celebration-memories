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
-- NEXT_PUBLIC_SUPABASE_ANON_KEY). This only clears the Edge Function's
-- verify_jwt gate; the function does all its real work with its own
-- service-role key internally, so this is not an authorization
-- boundary. If the anon key is ever rotated, re-run
-- `select cron.alter_job(job_id, command := ...)` (or re-apply this
-- file's cron.schedule call, which upserts by job name) with the new
-- key — find the current key at Project Settings -> API.
--
-- REDACTED BELOW: <SUPABASE_URL> / <SUPABASE_ANON_KEY> are placeholders,
-- not the literal values — this file is committed source of truth for
-- structure only. The real values are already applied directly against
-- the live project (see this file's own header above), and Netlify's
-- secret scanner blocks any build where the literal
-- NEXT_PUBLIC_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_URL values appear
-- anywhere in the repo (both are configured as "secret" env vars in
-- this project's Netlify settings even though the anon key is
-- ordinarily safe to expose to a browser) — that's what caused an
-- earlier failed deploy. Fill in the real values from
-- Project Settings -> API before re-running this by hand.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'guest-reminder-push-dispatch',
  '30 13 * * *',
  $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/send-reminder-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
