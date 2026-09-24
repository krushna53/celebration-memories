-- Public AI invitation-image tool: move the OpenAI call out of the
-- Netlify function (app/api/public-ai-image/route.ts) into a Supabase
-- Edge Function (supabase/functions/generate-public-ai-image).
--
-- Image generation takes 20-60s — longer than Netlify's synchronous
-- function limit — so the old route was killed mid-request and the
-- browser got a non-JSON timeout page ("Something went wrong. Please
-- check your connection"). This table had 0 rows in production when
-- this migration was written: the public tool had never once succeeded.
--
-- New flow: the Next.js route validates + rate-limits, then inserts a
-- row here as a single-use "ticket" (status 'pending', holding the
-- server-validated prompt). The Edge Function atomically claims that
-- ticket (pending -> processing), generates, and marks it 'done' — or
-- deletes it on failure so a failed attempt doesn't burn the visitor's
-- hourly allowance. Pending rows count toward the rate limit, so firing
-- several tickets in parallel can't exceed it either.

alter table public.public_ai_image_requests
  add column if not exists prompt text,
  add column if not exists status text not null default 'done'
    check (status in ('pending', 'processing', 'done'));
