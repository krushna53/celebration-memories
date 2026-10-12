create or replace function public.activate_free_event(eid uuid, buyer uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare e public.events; claimed uuid;
begin
  -- Serialize activations for this account, including requests for different drafts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(buyer::text, 0));
  -- The server verifies the Auth session and email before calling this service-only RPC.
  if not exists (select 1 from public.admins where id=buyer and role<>'owner') then
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
