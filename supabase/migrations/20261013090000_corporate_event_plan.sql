-- "Corporate Event" per-event plan (₹4,999, lib/event-plans.ts): same
-- one-time, 12-month checkout as Celebration/Studio, with 50 GB storage.
-- Team size (21 members) is applied in services/admin-team.ts.
-- apply_plan_order is unchanged apart from the storage case.
alter table public.plan_orders drop constraint plan_orders_plan_check;
alter table public.plan_orders add constraint plan_orders_plan_check check (plan in ('celebration','studio','corporate'));

create or replace function public.apply_plan_order(oid uuid, eid uuid, buyer uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.plan_orders; e public.events;
begin
 select * into o from public.plan_orders where id=oid for update;
 if not found or o.user_id<>buyer or o.status<>'paid' or o.environment<>'production' then raise exception 'No available purchase'; end if;
 if o.event_id is not null then
  if o.event_id=eid then return; end if;
  raise exception 'This purchase already belongs to an event';
 end if;
 select * into e from public.events where id=eid for update;
 if not found or e.owner_user_id is distinct from buyer then raise exception 'Only the event owner can apply this purchase'; end if;
 if exists(select 1 from public.admins where id=buyer and role='owner') then raise exception 'Platform support cannot claim customer purchases'; end if;
 update public.plan_orders set event_id=eid,applied_at=now(),access_until=now()+interval '12 months' where id=oid;
 update public.events set status='active', storage_quota_gb=greatest(coalesce(storage_quota_gb,0),case when o.plan='corporate' then 50 when o.plan='studio' then 25 else 5 end) where id=eid;
end; $$;
revoke all on function public.apply_plan_order(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_plan_order(uuid,uuid,uuid) to service_role;
