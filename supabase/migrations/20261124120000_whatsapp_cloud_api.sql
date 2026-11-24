-- WhatsApp Cloud API notifications (Meta's official Business Platform).
-- See docs/WHATSAPP_INTEGRATION.md for the full design. Credentials
-- (access token, app secret, verify token) live only in server env vars
-- (WHATSAPP_*) — never in these tables.
--
-- Tables:
--   whatsapp_settings          singleton (id = 1): platform on/off switch,
--                              Meta template name per notification
--                              category, verified test recipients.
--   event_whatsapp_settings    per-event automation toggles (off by default).
--   whatsapp_consents          per-invitee opt-in (event notifications and,
--                              kept separate, marketing).
--   whatsapp_contacts          per-phone state for the shared platform
--                              number: global opt-out (STOP), last inbound
--                              message (24-hour customer-service window).
--   whatsapp_messages          the outbox AND the message log: one row per
--                              intended send, unique idempotency_key stops
--                              duplicates, wamid matches delivery webhooks.
--   whatsapp_webhook_events    raw webhook notifications, unique dedupe_key
--                              stops a redelivered webhook being applied twice.
--   whatsapp_audit_log         admin actions (settings, host-recorded consent,
--                              bulk and test sends).
--
-- RLS on with no policies, like every other table: all access is through
-- the service-role client in application code.

create table if not exists whatsapp_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  -- { "<category>": { "name": "<approved template name>", "language": "en" } }
  templates jsonb not null default '{}'::jsonb,
  -- E.164 digits (no +) the owner may send test messages to.
  test_recipients text[] not null default '{}',
  updated_at timestamptz not null default now()
);

insert into whatsapp_settings (id) values (1) on conflict (id) do nothing;

create table if not exists event_whatsapp_settings (
  event_id uuid primary key references events (id) on delete cascade,
  enabled boolean not null default false,
  rsvp_confirmation boolean not null default true,
  reminder_24h boolean not null default true,
  reminder_2h boolean not null default false,
  thank_you boolean not null default true,
  memory_reminder boolean not null default false,
  feedback_request boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_consents (
  invitee_id uuid primary key references invitees (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  -- Event-related notifications (invitation, RSVP confirmation, reminders, thank-you).
  opted_in boolean not null default false,
  consent_at timestamptz,
  -- 'rsvp_form' | 'public_rsvp_form' | 'host_attested' | 'whatsapp_reply'
  consent_source text,
  opted_out_at timestamptz,
  -- Marketing is a separate, explicit consent — never implied by the above.
  marketing_opted_in boolean not null default false,
  marketing_consent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_consents_event_idx on whatsapp_consents (event_id) where opted_in;

create table if not exists whatsapp_contacts (
  phone text primary key check (phone ~ '^[0-9]{8,15}$'),
  last_inbound_at timestamptz,
  opted_out_at timestamptz,
  opt_out_source text,
  updated_at timestamptz not null default now()
);

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  wamid text unique,
  event_id uuid references events (id) on delete set null,
  invitee_id uuid references invitees (id) on delete set null,
  admin_id uuid,
  recipient_phone text not null check (recipient_phone ~ '^[0-9]{8,15}$'),
  -- 'template' | 'text' | 'image' | 'document'
  message_type text not null,
  template_name text,
  -- Notification category (lib/whatsapp-cloud/types.ts WHATSAPP_CATEGORIES).
  category text not null,
  -- Graph API /messages body (minus the recipient), kept so the outbox can retry.
  payload jsonb not null,
  -- 'queued' | 'sending' | 'accepted' | 'sent' | 'delivered' | 'read' | 'failed'
  status text not null default 'queued',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  error_code integer,
  error_title text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_due_idx on whatsapp_messages (next_attempt_at) where status = 'queued';
create index if not exists whatsapp_messages_event_idx on whatsapp_messages (event_id, created_at desc);
create index if not exists whatsapp_messages_created_idx on whatsapp_messages (created_at desc);

create table if not exists whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  -- 'status' | 'message' | 'error'
  kind text not null,
  wamid text,
  from_phone text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists whatsapp_webhook_events_received_idx on whatsapp_webhook_events (received_at desc);

-- Admin actions (settings changes, consent recorded by a host, bulk sends, test sends).
create table if not exists whatsapp_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  event_id uuid references events (id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_audit_log_event_idx on whatsapp_audit_log (event_id, created_at desc);

alter table whatsapp_settings enable row level security;
alter table event_whatsapp_settings enable row level security;
alter table whatsapp_consents enable row level security;
alter table whatsapp_contacts enable row level security;
alter table whatsapp_messages enable row level security;
alter table whatsapp_webhook_events enable row level security;
alter table whatsapp_audit_log enable row level security;

-- Status counts for the admin stats cards (one round trip instead of a
-- count query per status). Service-role only, like every RPC here.
create or replace function whatsapp_status_counts(
  p_event_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_category text,
  p_status text
) returns table (status text, n bigint)
language sql stable
set search_path = public
as $$
  select m.status, count(*)::bigint
  from whatsapp_messages m
  where (p_event_id is null or m.event_id = p_event_id)
    and (p_from is null or m.created_at >= p_from)
    and (p_to is null or m.created_at <= p_to)
    and (p_category is null or m.category = p_category)
    and (p_status is null or m.status = p_status)
  group by m.status;
$$;

revoke all on function whatsapp_status_counts(uuid, timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function whatsapp_status_counts(uuid, timestamptz, timestamptz, text, text) to service_role;

-- Every 15 minutes: drain the outbox (retries) and queue due reminders /
-- post-event messages. Same pg_cron + pg_net + CRON_SECRET pattern as
-- 0028_admin_notifications_cron.sql. <SITE_URL> / <CRON_SECRET> are
-- placeholders — fill them in before running this part by hand.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'whatsapp-dispatch',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '<SITE_URL>/api/cron/whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
