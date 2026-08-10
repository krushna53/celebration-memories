-- Self-hosted live video streaming, simple-embed tier (#72). The
-- client picked the embed tier over a full self-hosted RTMP/HLS server
-- (which would require provisioning and paying for a separate VPS
-- outside this project's existing Netlify/Supabase stack) — this
-- stores the admin-pasted YouTube Live / Facebook Live URL and a
-- simple on/off toggle so the embed can be turned off between events
-- without clearing the saved URL. See lib/live-stream.ts for the
-- URL -> embeddable-iframe-src parsing and features/live-stream/ for
-- the section itself.
alter table public.events add column if not exists live_stream_enabled boolean not null default false;
alter table public.events add column if not exists live_stream_url text;
