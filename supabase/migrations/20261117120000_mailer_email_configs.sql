-- Corporate Event Mailer — Phase 1: company email configuration.
--
-- A "company" is a host account (the login that owns events, like
-- host_brands): every row carries tenant_user_id = that account's
-- auth.users id. Application code (services/mailer-email-config/) always
-- scopes reads and writes by the signed-in admin's own id, never an id the
-- browser sends.
--
-- Credentials are kept apart from the ordinary settings:
--   mailer_email_configs         sender identity + SMTP host/port/username, status
--   mailer_email_config_secrets  the SMTP password, AES-256-GCM encrypted by the
--                                app with MAILER_CREDENTIAL_ENCRYPTION_KEY (which
--                                never lives in the database), bound to its
--                                tenant + config id so a copied ciphertext can't
--                                be decrypted for another company
--   mailer_email_audit_logs      who changed / tested what (never secrets)
--
-- Like the rest of the app: RLS on with no policies and no grants for
-- anon/authenticated, so only the server (service role) can touch these
-- tables. The secrets table must never get a policy.
--
-- Campaign queue / delivery logs / suppression list come in Phase 2.

create table if not exists public.mailer_email_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  provider text not null check (provider in ('google', 'microsoft', 'ses', 'sendgrid', 'brevo', 'custom')),
  sender_name text not null check (char_length(sender_name) between 1 and 80),
  from_email text not null check (char_length(from_email) between 3 and 254),
  reply_to_email text check (reply_to_email is null or char_length(reply_to_email) between 3 and 254),
  reply_to_name text check (reply_to_name is null or char_length(reply_to_name) <= 80),
  smtp_host text not null check (char_length(smtp_host) between 1 and 253),
  smtp_port integer not null check (smtp_port in (25, 465, 587, 2525)),
  smtp_encryption text not null check (smtp_encryption in ('ssl', 'starttls')),
  smtp_username text check (smtp_username is null or char_length(smtp_username) <= 254),
  auth_enabled boolean not null default true,
  is_default boolean not null default false,
  sending_enabled boolean not null default true,
  dkim_selector text check (dkim_selector is null or dkim_selector ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$'),
  -- Set only by a real connection test / test email, never by saving.
  connection_status text not null default 'untested' check (connection_status in ('untested', 'ok', 'failed')),
  connection_checked_at timestamptz,
  connection_error text check (connection_error is null or char_length(connection_error) <= 400),
  -- When a test email was accepted by the SMTP server with the current settings.
  verified_at timestamptz,
  -- Last SPF/DKIM/DMARC lookup result (lib/mailer/email-config/dns-evaluate.ts).
  domain_check jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_user_id)
);

create index if not exists mailer_email_configs_tenant_idx on public.mailer_email_configs (tenant_user_id);
create unique index if not exists mailer_email_configs_one_default
  on public.mailer_email_configs (tenant_user_id) where is_default;

create table if not exists public.mailer_email_config_secrets (
  config_id uuid primary key,
  tenant_user_id uuid not null,
  password_ciphertext text not null check (char_length(password_ciphertext) <= 2000),
  -- Which encryption key produced the ciphertext (supports key rotation).
  key_id text not null check (char_length(key_id) <= 32),
  updated_at timestamptz not null default now(),
  -- The secret's tenant must be the config's tenant.
  foreign key (config_id, tenant_user_id)
    references public.mailer_email_configs (id, tenant_user_id) on delete cascade
);

create table if not exists public.mailer_email_audit_logs (
  id bigint generated always as identity primary key,
  tenant_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) <= 60),
  -- No FK: the log outlives a deleted configuration.
  config_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mailer_email_audit_logs_tenant_idx
  on public.mailer_email_audit_logs (tenant_user_id, action, created_at desc);

alter table public.mailer_email_configs enable row level security;
alter table public.mailer_email_config_secrets enable row level security;
alter table public.mailer_email_audit_logs enable row level security;

revoke all on public.mailer_email_configs from anon, authenticated;
revoke all on public.mailer_email_config_secrets from anon, authenticated;
revoke all on public.mailer_email_audit_logs from anon, authenticated;

grant all on public.mailer_email_configs to service_role;
grant all on public.mailer_email_config_secrets to service_role;
grant all on public.mailer_email_audit_logs to service_role;
