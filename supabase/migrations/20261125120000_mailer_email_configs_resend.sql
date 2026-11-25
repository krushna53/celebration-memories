-- Event Mailer → Email Settings: allow the "resend" provider (sends through
-- Resend's HTTP API with the company's own API key, stored encrypted in
-- mailer_email_config_secrets like an SMTP password — see
-- services/mailer-email-config/resend-transport.ts).
--
-- Only matters when MAILER_EMAIL_CONFIG_STORE=supabase; the Firestore store
-- has no such constraint. The inline check from 20261117120000 gets
-- Postgres's default name, mailer_email_configs_provider_check.

alter table public.mailer_email_configs
  drop constraint if exists mailer_email_configs_provider_check;

alter table public.mailer_email_configs
  add constraint mailer_email_configs_provider_check
  check (provider in ('google', 'microsoft', 'ses', 'sendgrid', 'brevo', 'resend', 'custom'));
