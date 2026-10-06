-- Token + cost tracking for the wizard's "Your Card" step, which reads
-- the event details off an uploaded invitation card with an OpenAI
-- vision call (lib/ai-invitation-card-reader.ts). One row per call —
-- successful or not, since a failed call that got as far as OpenAI is
-- still billed. Token counts come straight from OpenAI's response.usage;
-- the dollar conversion happens at read time (lib/usage-pricing.ts) so a
-- price change never needs a backfill. Shown on the owner-only
-- /admin/usage page (services/card-read-usage.ts).

create table if not exists ai_card_read_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events (id) on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  -- Part of output_tokens (reasoning models think before answering) —
  -- kept separately only to explain why output looks large.
  reasoning_tokens integer not null default 0,
  -- The image itself is billed as input tokens; cached input is cheaper.
  cached_input_tokens integer not null default 0,
  success boolean not null default true,
  fields_filled integer not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists ai_card_read_requests_created_idx on ai_card_read_requests (created_at desc);
create index if not exists ai_card_read_requests_event_idx on ai_card_read_requests (event_id);

alter table ai_card_read_requests enable row level security;
