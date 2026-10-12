-- Organiser / host branding: one brand per host account (the login that owns
-- events — events.owner_user_id). Shown as "Event powered by <brand>"
-- (with logo) on every event that account owns, unless the event sets its
-- own events.cobrand_name, and in the admin header for that event's team.
-- Read and written only through services/host-brands.ts with the service
-- role; RLS on with no policies, like the rest of the app.
create table if not exists public.host_brands (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  website_url text check (website_url is null or (char_length(website_url) <= 200 and website_url ~ '^https?://')),
  -- Path in the public `avatars` bucket, always under brands/<user_id>/.
  logo_path text check (logo_path is null or logo_path like 'brands/%'),
  apply_to_events boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.host_brands enable row level security;
revoke all on public.host_brands from anon, authenticated;
grant all on public.host_brands to service_role;
