-- ============================================================================
-- Celebration Memories — Phase 5 schema
-- Admin allowlist. Authentication itself is handled by Supabase Auth
-- (email + password); this table is purely an authorization allowlist —
-- being a valid Supabase Auth user is not enough to reach /admin, the
-- user's id must also have a row here.
-- ============================================================================

create table admins (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

-- Checked exclusively via the service-role client server-side (see
-- app/admin/layout.tsx) — no public policy needed or wanted here.
