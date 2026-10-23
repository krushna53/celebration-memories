-- "Build a timeline from photos" (lib/ai-timeline-writer.ts): one row
-- per AI call — the per-event / global rate limit and the real-token
-- cost record, same shape as rsvp_ai_generation_requests. Service role only.
create table if not exists public.timeline_ai_requests (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  group_count integer not null default 0,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  success boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists timeline_ai_requests_event_idx on public.timeline_ai_requests(event_id, created_at desc);
create index if not exists timeline_ai_requests_created_idx on public.timeline_ai_requests(created_at desc);

alter table public.timeline_ai_requests enable row level security;
revoke all on public.timeline_ai_requests from anon, authenticated;
grant all on public.timeline_ai_requests to service_role;
