-- Client self-serve account deletion (task #71) — an emailed one-time
-- code the client must enter before deleteAdminAccountAndAssets()
-- (services/admin-danger-zone.ts) actually runs. Short-lived, single
-- use (cleared immediately after a successful verification either way).
alter table public.admins
  add column if not exists deletion_code text,
  add column if not exists deletion_code_expires_at timestamptz;
