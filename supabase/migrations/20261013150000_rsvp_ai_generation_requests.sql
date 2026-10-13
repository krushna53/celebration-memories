-- "Generate with AI" in the RSVP form builder (lib/ai-rsvp-config.ts):
-- one row per AI call — the per-event / global rate limit and the
-- real-token cost record. Service role only.
create table if not exists public.rsvp_ai_generation_requests (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('prompt','image')),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  success boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rsvp_ai_generation_requests_event_idx on public.rsvp_ai_generation_requests(event_id, created_at desc);
create index if not exists rsvp_ai_generation_requests_created_idx on public.rsvp_ai_generation_requests(created_at desc);

alter table public.rsvp_ai_generation_requests enable row level security;
revoke all on public.rsvp_ai_generation_requests from anon, authenticated;
grant all on public.rsvp_ai_generation_requests to service_role;
