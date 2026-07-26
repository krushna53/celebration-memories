-- ============================================================================
-- Celebration Memories — admin content management
-- Lets the admin edit event details, gallery, and timeline from the
-- dashboard instead of hardcoded source files.
-- ============================================================================

alter table events add column occasion text;
alter table events add column maps_embed_url text;
alter table events add column parking_info text;

comment on column events.occasion is
  'Free-text label shown prominently on the site, e.g. "75th Birthday Celebration". Distinct from event_title, which is a poetic tagline (e.g. "75 Years of Love").';
comment on column events.maps_url is 'Google Maps "Get Directions" link.';
comment on column events.maps_embed_url is 'Google Maps embeddable iframe src URL.';

-- ----------------------------------------------------------------------------
-- gallery_photos — admin-curated gallery, separate from guest uploads
-- (photos table) which feed the Memory Wall instead.
-- ----------------------------------------------------------------------------
create table gallery_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  category text not null check (
    category in ('childhood', 'wedding', 'family', 'friends', 'travel', 'grandchildren')
  ),
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index gallery_photos_event_idx on gallery_photos (event_id, category, sort_order);

alter table gallery_photos enable row level security;

-- ----------------------------------------------------------------------------
-- timeline_milestones — admin-curated life timeline
-- ----------------------------------------------------------------------------
create table timeline_milestones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  period text not null,
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index timeline_milestones_event_idx on timeline_milestones (event_id, sort_order);

alter table timeline_milestones enable row level security;

-- Both tables follow the same posture as everything else: RLS enabled,
-- no public policies — reads for the public site and writes from the
-- admin dashboard both go through the service-role client server-side.
