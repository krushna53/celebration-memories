-- Customers can read their own orders; only the server can create or fulfil them.
create table public.plan_orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 plan text not null check (plan in ('celebration','studio')),
 amount_paise integer not null check (amount_paise > 0),
 currency text not null default 'INR' check (currency = 'INR'),
 environment text not null check (environment in ('sandbox','production')),
 status text not null default 'pending' check (status in ('pending','paid','expired')),
 customer_phone text not null,
 created_at timestamptz not null default now(),
 paid_at timestamptz,
 event_id uuid unique references public.events(id),
 applied_at timestamptz,
 access_until timestamptz
);
create index plan_orders_user_idx on public.plan_orders(user_id,created_at desc);
create unique index plan_orders_pending_idx on public.plan_orders(user_id,plan,environment) where status='pending';
alter table public.plan_orders enable row level security;
revoke all on public.plan_orders from anon, authenticated;
grant select on public.plan_orders to authenticated;
grant all on public.plan_orders to service_role;
create policy own_plan_orders on public.plan_orders for select to authenticated using(user_id=(select auth.uid()));

-- Idempotent fulfilment. Execute is private to the backend; values must come
-- from a fresh authenticated Cashfree order lookup, never the browser.
create function public.confirm_plan_order(oid uuid, verified_amount integer, verified_currency text, verified_environment text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.plan_orders;
begin
 select * into o from public.plan_orders where id=oid for update;
 if not found then raise exception 'Order not found'; end if;
 if o.amount_paise<>verified_amount or o.currency<>verified_currency or o.environment<>verified_environment then raise exception 'Payment mismatch'; end if;
 if o.status='paid' then return; end if;
 update public.plan_orders set status='paid',paid_at=now() where id=oid;
end; $$;
revoke all on function public.confirm_plan_order(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.confirm_plan_order(uuid,integer,text,text) to service_role;

-- Applying a purchase is explicit; no event is created or published on payment.
create function public.apply_plan_order(oid uuid, eid uuid, buyer uuid)
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
 update public.events set status='active', storage_quota_gb=greatest(coalesce(storage_quota_gb,0),case when o.plan='studio' then 25 else 5 end) where id=eid;
end; $$;
revoke all on function public.apply_plan_order(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_plan_order(uuid,uuid,uuid) to service_role;
