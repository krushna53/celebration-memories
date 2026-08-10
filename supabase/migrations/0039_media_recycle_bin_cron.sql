-- Recycle Bin, phase 2: automatic daily purge via pg_cron + pg_net.
-- Applied directly against the live project via MCP first (see
-- 0038's header comment and 0024_guest_reminder_cron.sql for why),
-- this is the matching committed source of truth.
--
-- Once a day (14:00 UTC = 7:30 PM IST/Asia/Kolkata), calls
-- supabase/functions/purge-expired-trash with no body, which
-- permanently deletes any gallery_photos/photos/videos/audio row
-- whose deleted_at is more than TRASH_RETENTION_DAYS (30) old —
-- Storage object first, then the row.
--
-- REDACTED BELOW: <SUPABASE_URL> / <SUPABASE_ANON_KEY> are placeholders,
-- not the literal values — same reasoning as 0024_guest_reminder_cron.sql's
-- header comment (Netlify's secret scanner blocks any build where the
-- literal NEXT_PUBLIC_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_URL values
-- appear in the repo). The real values are already applied directly
-- against the live project. Fill in the real values from
-- Project Settings -> API before re-running this by hand.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'media-recycle-bin-purge',
  '0 14 * * *',
  $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/purge-expired-trash',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
