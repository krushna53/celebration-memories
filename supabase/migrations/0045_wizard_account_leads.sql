-- ============================================================================
-- Celebration Memories — wizard "Create Account" drop-off leads
--
-- Captures a would-be host who reached the self-serve wizard's "Create
-- Account" step (features/start/account-form.tsx) but didn't make it
-- through cleanly — either Supabase Auth's signUp() call itself errored
-- (reason = 'error'), or they typed something into the form (at least an
-- email or phone) and then left the page without ever submitting
-- successfully (reason = 'abandoned'). Krushna Web Works gets an email
-- notification for each one (see lib/email.ts's
-- sendWizardAccountLeadNotification and services/wizard-leads.ts) so a
-- near-miss signup can be followed up on manually — this table is the
-- durable record backing that notification, and a lightweight lead list
-- an owner could query directly if needed.
-- ============================================================================

create table wizard_account_leads (
  id uuid primary key default gen_random_uuid(),
  draft_event_id uuid references events (id) on delete set null,
  name text,
  email text,
  phone text,
  reason text not null check (reason in ('error', 'abandoned')),
  error_message text,
  created_at timestamptz not null default now()
);

create index wizard_account_leads_draft_event_idx on wizard_account_leads (draft_event_id);
create index wizard_account_leads_created_at_idx on wizard_account_leads (created_at);

alter table wizard_account_leads enable row level security;
