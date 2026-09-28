-- ============================================================================
-- Security fix: close two tables and two functions that were reachable with
-- the public anon key (flagged by Supabase's security advisor, 2026-09-28).
--
-- 1. admin_mobile_sessions and concierge_inquiries were created without
--    `enable row level security`, so the anon role (whose key ships in every
--    browser bundle) could select/insert/delete rows directly through
--    PostgREST. For admin_mobile_sessions that meant anyone could mint a
--    bearer token for any admin_id, or read live ones — full admin takeover
--    via the mobile API. Both tables are only ever touched server-side through
--    supabaseAdmin() (services/admin-mobile-auth.ts, services/concierge.ts),
--    which uses the service role and bypasses RLS, so enabling RLS with no
--    policies — the same posture as every other table — changes nothing for
--    the app.
--
-- 2. redeem_promo_code() and handle_new_confirmed_admin() are SECURITY
--    DEFINER and were executable by anon/authenticated via /rest/v1/rpc/.
--    redeem_promo_code is only called server-side (services/promo-codes.ts);
--    exposed, it let anyone guess promo codes or burn their redemption counts
--    outside the app's own checks. handle_new_confirmed_admin is a trigger
--    function; triggers don't need EXECUTE at fire time, so revoking it from
--    API roles doesn't affect the trigger.
-- ============================================================================

alter table public.admin_mobile_sessions enable row level security;
alter table public.concierge_inquiries enable row level security;

revoke all on function public.redeem_promo_code(text) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(text) to service_role;

revoke all on function public.handle_new_confirmed_admin() from public, anon, authenticated;
