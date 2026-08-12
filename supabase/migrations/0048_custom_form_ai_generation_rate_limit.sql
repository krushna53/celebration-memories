-- Rate limiting for the Custom Form Builder's AI form generation
-- (prompt-to-form and image-to-form, both calling a paid OpenAI API —
-- see lib/ai-form-generator.ts, services/custom-form-ai-rate-limit.ts).
-- Same hashed-IP + rolling-window shape as public_ai_image_requests.
create table if not exists custom_form_ai_generation_requests (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_form_ai_generation_requests_ip_idx
  on custom_form_ai_generation_requests (ip_hash, created_at);

alter table custom_form_ai_generation_requests enable row level security;
