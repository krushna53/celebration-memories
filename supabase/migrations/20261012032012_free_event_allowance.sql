-- One lifetime free activation per customer; deleting an event does not reset it.
create table public.free_event_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  event_id uuid unique references public.events(id) on delete set null,
  claimed_at timestamptz not null default now()
);
alter table public.free_event_claims enable row level security;
revoke all on public.free_event_claims from anon, authenticated;
grant select on public.free_event_claims to authenticated;
grant all on public.free_event_claims to service_role;
create policy own_free_claim on public.free_event_claims for select to authenticated using (user_id = (select auth.uid()));

-- Existing live customer events remain live. An unpaid one uses the free allowance.
insert into public.free_event_claims(user_id, event_id)
select distinct on (e.owner_user_id) e.owner_user_id, e.id
from public.events e
where e.status = 'active' and e.owner_user_id is not null
  and not exists (select 1 from public.admins a where a.id=e.owner_user_id and a.role='owner')
  and not exists (select 1 from public.plan_orders o where o.event_id=e.id and o.status='paid' and o.environment='production')
  and not exists (select 1 from public.wizard_payments w where w.event_id=e.id and w.provider<>'free')
order by e.owner_user_id, e.created_at, e.id;

create function public.activate_free_event(eid uuid, buyer uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare e public.events; claimed uuid;
begin
  -- Serialize activations for this account, including requests for different drafts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(buyer::text, 0));
  if not exists (select 1 from auth.users where id=buyer and email_confirmed_at is not null and not coalesce(is_anonymous,false))
    or exists (select 1 from public.admins where id=buyer and role='owner') then
    raise exception 'Sign in with a verified customer account';
  end if;
  select * into e from public.events where id=eid for update;
  if not found or e.owner_user_id is distinct from buyer then
    raise exception 'Only the event owner can publish this event';
  end if;
  select event_id into claimed from public.free_event_claims where user_id=buyer;
  if found then
    if claimed=eid and e.status='active' then return; end if;
    raise exception 'Your free event has already been used. Choose a paid plan for this event.';
  end if;
  if e.status<>'draft' then raise exception 'This event is already active'; end if;
  insert into public.free_event_claims(user_id,event_id) values(buyer,eid);
  update public.events set status='active',storage_quota_gb=0.25 where id=eid;
  insert into public.wizard_payments(event_id,admin_id,provider,plan,amount,currency)
    values(eid,buyer,'free','one_time',0,'inr');
end; $$;
revoke all on function public.activate_free_event(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_free_event(uuid,uuid) to service_role;
