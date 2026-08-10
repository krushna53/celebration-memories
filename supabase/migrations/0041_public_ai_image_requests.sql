-- Standalone public quick AI invitation-image tool (#81) — a no-account,
-- no-event marketing/lead-gen tool at /ai-invitation-image that anyone
-- can use to generate one AI invitation image, no login required.
--
-- Unlike the admin AI Image feature (ai_image_jobs), this endpoint is
-- reachable by anyone on the internet and calls a real pay-per-image
-- API with no admin auth gate — so instead of a per-event quota
-- (events.ai_image_generation_limit), this table backs a per-IP +
-- global daily rate limit enforced in app/api/public-ai-image/route.ts
-- BEFORE calling OpenAI. Only a hashed IP is stored (sha256, see
-- lib/ip-hash.ts), never the raw address — this table exists purely
-- for abuse/cost control bookkeeping, not analytics.
--
-- No image itself is persisted here or in Storage — the generated PNG
-- is returned to the browser as a data URL and shown/downloaded
-- client-side only, so there's nothing to moderate, clean up, or purge.
create table if not exists public.public_ai_image_requests (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists public_ai_image_requests_ip_hash_idx on public.public_ai_image_requests (ip_hash, created_at);
create index if not exists public_ai_image_requests_created_at_idx on public.public_ai_image_requests (created_at);

alter table public.public_ai_image_requests enable row level security;
