-- Admin-facing notification center (bell icon in the admin dashboard),
-- covering three producers requested together: RSVP-submitted alerts,
-- daily feature-discovery nudges, and storage-quota warnings, plus a
-- post-event "new event plans" prompt. One shared table/inbox per
-- explicit request, scoped by admin_id (not event_id) so both the
-- owner and a client-role admin each see their own list — a
-- notification about a specific event still carries event_id for
-- building a link/context, but "who sees it" is always admin_id.
--
-- No separate "already notified" tracking table — de-duplication for
-- the recurring producers (feature nudges, storage warnings, new-event
-- prompts) works by querying this table itself for a prior row of the
-- same type (+ metadata->>feature_key where relevant) before inserting
-- another, same reuse-the-log-as-source-of-truth pattern used for
-- guest activity_logs elsewhere in this app. Applied live via MCP
-- first per this repo's established practice; this file is the
-- matching committed source of truth.
create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins (id) on delete cascade,
  event_id uuid references events (id) on delete cascade,
  type text not null, -- 'rsvp_submitted' | 'feature_nudge' | 'storage_usage' | 'new_event_prompt'
  title text not null,
  body text not null,
  link text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_admin_id_created_at_idx
  on admin_notifications (admin_id, created_at desc);
create index if not exists admin_notifications_admin_id_unread_idx
  on admin_notifications (admin_id) where read_at is null;

alter table admin_notifications enable row level security;

-- Editable storage quota per event, default 5 GB, shown against the
-- already-existing live usage computation (services/storage-usage.ts)
-- rather than a new cached-usage column — no quota/plan-limit system
-- existed before this, so 5 GB is a starting default only, not tied to
-- any real pricing plan yet.
alter table events add column if not exists storage_quota_gb numeric not null default 5;
