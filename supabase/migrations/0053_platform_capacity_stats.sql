-- Three read-only, aggregate-only SECURITY DEFINER functions backing
-- the owner-only Platform Utilization dashboard (/admin/platform-usage,
-- services/platform-capacity.ts). Each returns only counts/byte totals
-- — never individual rows or any PII — so exposing them via RPC to the
-- service-role client (already how every other admin-only read in this
-- app is authorized: no public policies, app-code gating) carries no
-- extra data-exposure risk. Needed because the Postgres system
-- catalogs (pg_database_size, storage.objects, auth.users) aren't
-- reachable through the normal PostgREST table API the rest of this
-- app uses via supabaseAdmin().from(...).

-- Whole-database size on disk — compared against the Supabase plan's
-- included disk allowance (8 GB on Pro as of this writing) on the
-- dashboard. Not the same number as "Disk" shown in the Supabase
-- project dashboard's usage graphs (that also includes WAL/indexes
-- overhead this doesn't) — close enough for a capacity-planning
-- estimate, not a billing-accurate figure.
create or replace function public.platform_db_size_bytes()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

-- Total Supabase Storage usage, one row per bucket — sums the `size`
-- key Storage writes into each object's metadata jsonb on upload.
-- Mirrors what services/storage-usage.ts's getEventStorageUsage()
-- already computes per-event via the Storage API's list() calls, but
-- as one aggregate query instead of a recursive per-event/per-folder
-- walk — the per-event breakdown stays as-is (still needed for the
-- per-event cost table), this is just the platform-wide total.
create or replace function public.platform_storage_usage()
returns table(bucket_id text, object_count bigint, total_bytes bigint)
language sql
security definer
set search_path = public
as $$
  select
    storage.objects.bucket_id,
    count(*)::bigint as object_count,
    coalesce(sum((storage.objects.metadata->>'size')::bigint), 0)::bigint as total_bytes
  from storage.objects
  group by storage.objects.bucket_id;
$$;

-- Total signed-up accounts and a 28-day "active" proxy for Supabase's
-- billed Monthly Active Users metric (Supabase's own MAU definition
-- may weight things like OTP/anonymous sign-ins differently — this is
-- an estimate for capacity planning, not what actually appears on the
-- invoice). Counts every auth.users row regardless of which of the
-- three product tables (if any) it belongs to, since MAU billing is
-- per Supabase Auth user, not per admins/business_accounts/form_owners
-- row.
create or replace function public.platform_auth_user_stats()
returns table(total_users bigint, active_28d bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint as total_users,
    count(*) filter (where last_sign_in_at > now() - interval '28 days')::bigint as active_28d
  from auth.users;
$$;

revoke all on function public.platform_db_size_bytes() from public, anon, authenticated;
revoke all on function public.platform_storage_usage() from public, anon, authenticated;
revoke all on function public.platform_auth_user_stats() from public, anon, authenticated;
grant execute on function public.platform_db_size_bytes() to service_role;
grant execute on function public.platform_storage_usage() to service_role;
grant execute on function public.platform_auth_user_stats() to service_role;
