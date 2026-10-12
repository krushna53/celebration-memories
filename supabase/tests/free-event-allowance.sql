-- Run as postgres against a migrated database. All fixtures roll back.
begin;
do $$
declare buyer uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values(buyer,buyer::text||'@example.invalid','{}','{}');
 insert into public.admins(id,email,name,role) values(buyer,buyer::text||'@example.invalid','Allowance test','client');
 insert into public.events(id,slug,honoree_name,event_title,hosted_by,start_at,end_at,status,owner_user_id)
 values(eid,eid::text,'Allowance test','Test','Test',now(),now()+interval '1 hour','draft',buyer),
 (second_id,second_id::text,'Allowance test','Test','Test',now(),now()+interval '1 hour','draft',buyer);
 perform set_config('em.test_buyer',buyer::text,true);
 perform set_config('em.test_event',eid::text,true);
 perform set_config('em.test_second',second_id::text,true);
end $$;
set local role service_role;
do $$
declare buyer uuid:=current_setting('em.test_buyer')::uuid; eid uuid:=current_setting('em.test_event')::uuid; second_id uuid:=current_setting('em.test_second')::uuid;
begin
 perform public.activate_free_event(eid,buyer);
 perform public.activate_free_event(eid,buyer);
 if (select count(*) from public.free_event_claims where user_id=buyer)<>1 then raise exception 'Duplicate claim'; end if;
 if (select count(*) from public.wizard_payments where event_id=eid)<>1 then raise exception 'Duplicate payment'; end if;
 if not exists(select 1 from public.events where id=eid and status='active' and storage_quota_gb=0.25) then raise exception 'Activation failed'; end if;
 begin
   perform public.activate_free_event(second_id,buyer);
   raise exception 'TEST FAILED: second free event accepted';
 exception when others then
   if sqlerrm not like 'Your free event has already been used%' then raise; end if;
 end;
 -- Simulate the foreign key's ON DELETE SET NULL result.
 update public.free_event_claims set event_id=null where user_id=buyer;
 begin
   perform public.activate_free_event(second_id,buyer);
   raise exception 'TEST FAILED: deletion reset free allowance';
 exception when others then
   if sqlerrm not like 'Your free event has already been used%' then raise; end if;
 end;
 if has_function_privilege('authenticated','public.activate_free_event(uuid,uuid)','execute')
   or has_function_privilege('anon','public.activate_free_event(uuid,uuid)','execute') then
   raise exception 'TEST FAILED: client can bypass server verification';
 end if;
end $$;
rollback;
select 'PASS: activation, idempotency, second-event rejection, retained allowance, client permissions' as result;
