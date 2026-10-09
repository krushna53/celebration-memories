-- Optional day/date label for multi-day schedules; existing entries stay unchanged.
alter table public.event_schedule_items
  add column if not exists day_label text;
