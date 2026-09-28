-- ============================================================================
-- Brute-force protection for short, guessable secrets (services/abuse-guard.ts)
--
-- Guest invite links are 8 characters, mobile access codes 10, promo codes
-- are human-chosen words, and the private Event Day page is unlocked by a
-- phone number. None of that is guessable by hand, but a script could try
-- thousands of values an hour. Every FAILED lookup is recorded here against
-- a salted hash of the caller's IP (never the raw IP — see lib/ip-hash.ts);
-- once an IP has too many recent failures for a scope, further lookups from
-- it are refused for the rest of the window, even with a correct value.
--
-- Only failures are written, so real guests (who open a valid link) never
-- add rows — a whole venue sharing one Wi-Fi IP isn't affected unless
-- someone on it is actually guessing.
--
-- RLS on with no policies, same as every other table: only the service role
-- (server code) reads or writes it.
-- ============================================================================

create table public.security_failed_attempts (
  id bigint generated always as identity primary key,
  scope text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index security_failed_attempts_lookup_idx
  on public.security_failed_attempts (scope, ip_hash, created_at desc);

alter table public.security_failed_attempts enable row level security;
