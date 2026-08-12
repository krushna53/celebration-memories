-- Custom Form Builder (#95-101): a standalone, platform-wide, no-login
-- form builder — independent of the per-event RSVP system. A "form
-- owner" account is a separate, lightweight allowlist (form_owners),
-- distinct from the event-scoped `admins` table, since one person can
-- own many forms with no event relationship at all. Building a form
-- needs no account (see custom_forms.draft_token — same bearer-token
-- trust model as events.draft_token / invitees.token); an account is
-- only needed to view/manage responses afterward.

create table if not exists form_owners (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists custom_forms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references form_owners (id) on delete set null,
  -- Long random URL token granting write access to build/edit this
  -- form with no login — same pattern as events.draft_token. Stays
  -- valid even after publish, so an owner who skips account creation
  -- can still get back in via the same link.
  draft_token text not null unique,
  -- Public URL slug for the fill page (/f/[slug]), independent of the
  -- draft_token so the public link never leaks the edit credential.
  slug text not null unique,
  title text not null default 'Untitled Form',
  description text,
  cover_image_path text,
  notify_email text,
  notify_on_submit boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_forms_owner_id_idx on custom_forms (owner_id);
create index if not exists custom_forms_draft_token_idx on custom_forms (draft_token);
create index if not exists custom_forms_slug_idx on custom_forms (slug);

create table if not exists custom_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references custom_forms (id) on delete cascade,
  label text not null,
  field_type text not null check (
    field_type in ('text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'radio', 'checkbox')
  ),
  -- Choices for select/radio/checkbox fields — a JSON array of strings. Null for every other field_type.
  options jsonb,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists custom_form_fields_form_id_idx on custom_form_fields (form_id);

create table if not exists custom_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references custom_forms (id) on delete cascade,
  -- Keyed by field id (not label) so renaming a field later doesn't
  -- orphan already-submitted data. { [fieldId]: string | string[] }.
  data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists custom_form_responses_form_id_idx on custom_form_responses (form_id);

-- RLS enabled with no public policies, same as every other table in
-- this app — authorization is enforced in application code
-- (supabaseAdmin() service-role client + Server Action checks), not
-- database-level policies.
alter table form_owners enable row level security;
alter table custom_forms enable row level security;
alter table custom_form_fields enable row level security;
alter table custom_form_responses enable row level security;
