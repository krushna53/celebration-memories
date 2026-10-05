-- Per-event storage total, for enforcing events.storage_quota_gb at upload
-- time (services/storage-quota.ts). storage_usage_by_event() (0064) scans
-- every object in every bucket, which is fine for dashboards but too much
-- to run before each upload; this sums only one event's prefix.
--
-- Same rule as 0064: an object belongs to an event when its path starts
-- with "<event uuid>/". Counts every bucket, so the quota covers guest
-- memories, gallery, timeline, AI images, slideshow files and so on.
--
-- Read-only, SECURITY DEFINER (storage schema), service role only.

create or replace function public.event_storage_bytes(p_event_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public, storage
as $$
  select coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0)::bigint
  from storage.objects
  where name like p_event_id::text || '/%';
$$;

revoke all on function public.event_storage_bytes(uuid) from public, anon, authenticated;
grant execute on function public.event_storage_bytes(uuid) to service_role;
