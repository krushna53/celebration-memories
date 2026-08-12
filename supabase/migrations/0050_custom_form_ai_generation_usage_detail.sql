-- Enriches the AI form-generation log (previously just ip_hash +
-- created_at, for rate-limiting only) with enough detail to build a
-- real usage/cost report: which mode was used, which model served the
-- request, actual token counts from the OpenAI response, and which
-- form/category it was for (denormalized at write time so the report
-- survives the form later being deleted or recategorized).

alter table custom_form_ai_generation_requests
  add column if not exists mode text;

alter table custom_form_ai_generation_requests
  add constraint custom_form_ai_generation_requests_mode_check
  check (mode is null or mode in ('prompt', 'image'));

alter table custom_form_ai_generation_requests
  add column if not exists model text;

alter table custom_form_ai_generation_requests
  add column if not exists input_tokens integer not null default 0;

alter table custom_form_ai_generation_requests
  add column if not exists output_tokens integer not null default 0;

alter table custom_form_ai_generation_requests
  add column if not exists form_id uuid references custom_forms (id) on delete set null;

alter table custom_form_ai_generation_requests
  add column if not exists category text;

create index if not exists custom_form_ai_generation_requests_created_at_idx
  on custom_form_ai_generation_requests (created_at);
