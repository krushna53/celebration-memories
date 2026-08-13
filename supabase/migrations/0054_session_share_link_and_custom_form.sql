-- Workshop feature (#106) Phase 1: lets a session organizer share ONE
-- schedule item as its own guest-facing link, independent of the
-- event's full private Event Day link — and optionally attach an
-- existing Custom Form Builder form for extra registration questions,
-- per the product decision to reuse that system rather than build a
-- second, lighter field mechanism.

alter table event_schedule_items
  add column if not exists share_token text unique,
  add column if not exists custom_form_id uuid references custom_forms (id) on delete set null;

create index if not exists event_schedule_items_share_token_idx on event_schedule_items (share_token);
create index if not exists event_schedule_items_custom_form_id_idx on event_schedule_items (custom_form_id);
