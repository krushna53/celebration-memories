-- Guest reminder system (Web Push), phase 1: subscriptions table + per-
-- event controls. Applied directly against the live project via MCP
-- first (per this repo's established practice — see 0022's own header
-- comment), this file is the matching committed source of truth so the
-- schema isn't only living live. Run manually against a fresh project
-- if ever rebuilding from these migrations alone.
--
-- Design notes (see celebration-memories/CLAUDE.md for the fuller
-- picture once documented there):
--   * No new "upload_attempts" table — abandoned video/audio recording
--     or upload attempts are derived from the existing activity_logs
--     event log instead (event_type values
--     'video_record_started' / 'video_upload_started' /
--     'audio_record_started' / 'audio_upload_started', already paired
--     with the existing '{kind}_uploaded' events logged by
--     features/uploads/actions.ts's confirmUpload, plus a new
--     'reminder_sent_{kind}' event marking a reminder already fired so
--     the same abandoned attempt is never reminded twice). Reusing
--     activity_logs keeps this additive rather than introducing a
--     second parallel event-log table.
--   * Scoped to invitee-token guests only (/invite/[token]) — the
--     public no-token /events/[slug]/memories flow has no stable
--     per-guest identity to attach a push subscription to.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  invitee_id uuid not null references invitees (id) on delete cascade,
  event_id uuid not null references events (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (invitee_id, endpoint)
);

create index if not exists push_subscriptions_invitee_id_idx on push_subscriptions (invitee_id);
create index if not exists push_subscriptions_event_id_idx on push_subscriptions (event_id);

alter table push_subscriptions enable row level security;

-- Per-event controls for the guest reminder feature, same on/off +
-- tunable-limit shape as ai_avatar_enabled / ai_avatar_daily_message_limit
-- (see services/events.ts's three-point toggle pattern).
alter table events add column if not exists guest_reminder_enabled boolean not null default true;
alter table events add column if not exists guest_reminder_delay_minutes integer not null default 60;
