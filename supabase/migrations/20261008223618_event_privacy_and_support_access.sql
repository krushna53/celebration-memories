-- Additive privacy model. `visibility` remains directory discovery; existing
-- direct links keep working. An unassigned owner can NEVER approve support.
begin;
create schema if not exists event_security;
revoke all on schema event_security from public;
grant usage on schema event_security to authenticated, service_role;

alter table public.events
  add column viewing_access text not null default 'public' check (viewing_access in ('public','signed_in','invited_only')),
  add column public_access_pinned boolean not null default false,
  add column owner_user_id uuid references auth.users(id) on delete set null;
-- Existing application identifies the first client member as the host.
update public.events e set owner_user_id = (
  select m.admin_id from public.admin_event_memberships m join public.admins a on a.id=m.admin_id
  where m.event_id=e.id and m.role='client' and a.role<>'owner'
  order by m.created_at,m.admin_id limit 1
);
-- Explicit rollout exceptions requested by the platform owner. Listing and
-- publication stay unchanged; removing the exception does not make it private.
update public.events set public_access_pinned=true where slug in
 ('75th-birthday-mahesh-shah','veda-s-1st-birthday','mgm-medical-college-53rd-reunion-batch-73');
create table public.event_privacy_changes (
 id bigint generated always as identity primary key, event_id uuid not null references public.events(id),
 actor_user_id uuid not null references auth.users(id), action text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.event_privacy_changes enable row level security;
revoke all on public.event_privacy_changes from anon,authenticated;
create index events_owner_user_idx on public.events(owner_user_id);
create index invitees_event_email_privacy_idx on public.invitees(event_id,lower(trim(email)));

create table public.support_access_requests (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id),
 admin_user_id uuid not null references auth.users(id), owner_user_id uuid not null references auth.users(id),
 reason text not null check (length(trim(reason)) between 10 and 500),
 duration_minutes integer not null check(duration_minutes in (15,30)),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled','expired')),
 created_at timestamptz not null default clock_timestamp(), decided_at timestamptz,
 decided_by uuid references auth.users(id), check(admin_user_id<>owner_user_id)
);
create unique index support_pending_unique on public.support_access_requests(event_id,admin_user_id) where status='pending';
create index support_requests_owner_idx on public.support_access_requests(owner_user_id,created_at desc);
create index support_requests_admin_idx on public.support_access_requests(admin_user_id,created_at desc);
create table public.support_access_grants (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.support_access_requests(id),
 event_id uuid not null references public.events(id), admin_user_id uuid not null references auth.users(id),
 owner_user_id uuid not null references auth.users(id),
 status text not null default 'active' check(status in ('active','revoked','expired')),
 starts_at timestamptz not null, expires_at timestamptz not null,
 revoked_at timestamptz, revoked_by uuid references auth.users(id),
 check(expires_at>starts_at and expires_at<=starts_at+interval '30 minutes'),
 check(admin_user_id<>owner_user_id)
);
create index support_grants_access_idx on public.support_access_grants(event_id,admin_user_id,expires_at);
create table public.support_access_audit_log (
 id bigint generated always as identity primary key,
 request_id uuid not null references public.support_access_requests(id),
 grant_id uuid references public.support_access_grants(id), event_id uuid not null references public.events(id),
 admin_user_id uuid not null, owner_user_id uuid not null, actor_user_id uuid,
 action text not null, reason text not null, outcome text not null,
 media_id text, created_at timestamptz not null default clock_timestamp()
);
create index support_audit_event_idx on public.support_access_audit_log(event_id,created_at desc);
alter table public.support_access_requests enable row level security;
alter table public.support_access_grants enable row level security;
alter table public.support_access_audit_log enable row level security;
revoke all on public.support_access_requests,public.support_access_grants,public.support_access_audit_log from anon,authenticated;
grant select on public.support_access_requests,public.support_access_grants,public.support_access_audit_log to authenticated;
grant all on public.support_access_requests,public.support_access_grants,public.support_access_audit_log to service_role;
grant usage,select on sequence public.support_access_audit_log_id_seq to service_role;

create function event_security.is_event_owner(eid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.events where id=eid and owner_user_id=auth.uid());
$$;
create policy support_requests_read on public.support_access_requests for select to authenticated
 using(admin_user_id=(select auth.uid()) or event_security.is_event_owner(event_id));
create policy support_grants_read on public.support_access_grants for select to authenticated
 using(admin_user_id=(select auth.uid()) or event_security.is_event_owner(event_id));
create policy support_audit_read on public.support_access_audit_log for select to authenticated
 using(admin_user_id=(select auth.uid()) or event_security.is_event_owner(event_id));

create function event_security.log_support(r public.support_access_requests, action_name text, result text, gid uuid default null, media text default null)
returns void language sql security definer set search_path='' as $$
 insert into public.support_access_audit_log(request_id,grant_id,event_id,admin_user_id,owner_user_id,actor_user_id,action,reason,outcome,media_id)
 values(r.id,gid,r.event_id,r.admin_user_id,r.owner_user_id,auth.uid(),action_name,r.reason,result,media);
$$;
revoke all on function event_security.log_support(public.support_access_requests,text,text,uuid,text) from public,anon,authenticated;

create function public.request_support_access(eid uuid, support_reason text, minutes integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.support_access_requests; host uuid; now_time timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or not exists(select 1 from public.admins where id=auth.uid() and role='owner') then raise exception 'Platform administrator required'; end if;
 if minutes not in (15,30) or support_reason is null or length(trim(support_reason)) not between 10 and 500 then raise exception 'Provide a reason (10–500 characters) and 15 or 30 minutes'; end if;
 -- Serialize all requests from this admin, across events, for throttling.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select owner_user_id into host from public.events where id=eid for update;
 if host is null or host=auth.uid() then raise exception 'An independent event owner must be assigned first'; end if;
 if exists(select 1 from public.admins where id=host and role='owner') then raise exception 'Customer approval required'; end if;
 if (select count(*) from public.support_access_requests where admin_user_id=auth.uid() and created_at>now_time-interval '1 hour')>=5 then raise exception 'Please wait before requesting more support access'; end if;
 if exists(select 1 from public.support_access_requests where event_id=eid and admin_user_id=auth.uid() and created_at>now_time-interval '5 minutes') then raise exception 'Please wait five minutes before requesting access again'; end if;
 for r in update public.support_access_requests set status='expired',decided_at=now_time
   where event_id=eid and admin_user_id=auth.uid() and status='pending' and created_at<=now_time-interval '24 hours' returning * loop
   perform event_security.log_support(r,'request_expired','expired');
 end loop;
 insert into public.support_access_requests(event_id,admin_user_id,owner_user_id,reason,duration_minutes)
 values(eid,auth.uid(),host,trim(support_reason),minutes) returning * into r;
 perform event_security.log_support(r,'requested','pending');
 insert into public.admin_notifications(admin_id,event_id,type,title,body,link)
 values(host,eid,'support_access','Temporary media access requested',
 'Administrator '||auth.uid()::text||' requests '||minutes||' minutes of read-only access. Reason: '||trim(support_reason)||'. Access begins only after approval and expires automatically.',
 '/admin/privacy?event='||eid::text);
 perform event_security.log_support(r,'notification','in_app_delivered');
 return r.id;
end; $$;

create function public.decide_support_access(rid uuid, approve boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.support_access_requests; gid uuid; start_time timestamptz:=clock_timestamp();
begin
 select * into r from public.support_access_requests where id=rid for update;
 if r.id is null or auth.uid() is null or auth.uid()=r.admin_user_id or auth.uid()<>r.owner_user_id or not event_security.is_event_owner(r.event_id) then raise exception 'Only the event owner can decide this request'; end if;
 if r.status<>'pending' then return; end if;
 if r.created_at<start_time-interval '24 hours' then
  update public.support_access_requests set status='expired',decided_at=start_time where id=rid;
  perform event_security.log_support(r,'request_expired','denied'); return;
 end if;
 update public.support_access_requests set status=case when approve then 'approved' else 'rejected' end,decided_at=start_time,decided_by=auth.uid() where id=rid;
 if approve then
  insert into public.support_access_grants(request_id,event_id,admin_user_id,owner_user_id,starts_at,expires_at)
  values(r.id,r.event_id,r.admin_user_id,r.owner_user_id,start_time,start_time+make_interval(mins=>r.duration_minutes)) returning id into gid;
  perform event_security.log_support(r,'approved','allowed',gid);
  perform event_security.log_support(r,'grant_activated','read_only',gid);
 else perform event_security.log_support(r,'rejected','denied'); end if;
end; $$;

create function public.revoke_support_access(gid uuid) returns void language plpgsql security definer set search_path='' as $$
declare g public.support_access_grants; r public.support_access_requests;
begin
 select * into g from public.support_access_grants where id=gid for update;
 if g.id is null or auth.uid() is null or auth.uid()=g.admin_user_id or not event_security.is_event_owner(g.event_id) then raise exception 'Only the event owner can revoke access'; end if;
 if g.status<>'active' then return; end if;
 update public.support_access_grants set status='revoked',revoked_at=clock_timestamp(),revoked_by=auth.uid() where id=gid;
 select * into r from public.support_access_requests where id=g.request_id;
 perform event_security.log_support(r,'revoked','denied',gid);
end; $$;

-- Returns an expiry only for this verified administrator and this exact event.
-- Expiry is checked on every call; the status update is reporting, not security.
create function public.support_access_expiry(eid uuid, media text default null)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare g public.support_access_grants; r public.support_access_requests; until_time timestamptz;
begin
 if auth.uid() is null then return null; end if;
 for g in update public.support_access_grants set status='expired'
  where event_id=eid and admin_user_id=auth.uid() and status='active' and expires_at<=clock_timestamp() returning * loop
  select * into r from public.support_access_requests where id=g.request_id;
  perform event_security.log_support(r,'expired','denied',g.id);
 end loop;
 select * into g from public.support_access_grants
 where event_id=eid and admin_user_id=auth.uid() and status='active' and revoked_at is null
 and starts_at<=clock_timestamp() and expires_at>clock_timestamp()
 and exists(select 1 from public.events e where e.id=eid and e.owner_user_id=support_access_grants.owner_user_id)
 and exists(select 1 from public.admins a where a.id=auth.uid() and a.role='owner')
 order by expires_at desc limit 1;
 until_time:=g.expires_at;
 select * into r from public.support_access_requests where event_id=eid and admin_user_id=auth.uid() order by created_at desc limit 1;
 if r.id is not null then perform event_security.log_support(r,'media_access_check',case when until_time is null then 'denied' else 'allowed' end,g.id,left(media,200)); end if;
 return until_time;
end; $$;

create function public.set_event_viewing_access(eid uuid, mode text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.events where id=eid for update;
 if not event_security.is_event_owner(eid) then raise exception 'Only the event owner can change privacy'; end if;
 if mode<>'public' and exists(select 1 from public.events where id=eid and public_access_pinned) then raise exception 'This event is marked Keep public by the platform administrator'; end if;
 if mode not in ('public','signed_in','invited_only') or mode is null then raise exception 'Invalid privacy setting'; end if;
 update public.events set viewing_access=mode where id=eid;
 insert into public.event_privacy_changes(event_id,actor_user_id,action) values(eid,auth.uid(),'viewing_access:'||mode);
end; $$;

-- First client host of a new/unassigned event becomes its owner; no global
-- administrator is eligible. Existing ownership cannot be replaced by a member.
create function event_security.assign_first_host() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role='client' and exists(select 1 from public.admins where id=new.admin_id and role<>'owner') then
  update public.events set owner_user_id=new.admin_id where id=new.event_id and owner_user_id is null;
 end if;
 return new;
end; $$;
create trigger memberships_assign_first_host after insert on public.admin_event_memberships for each row execute function event_security.assign_first_host();

-- RLS remains deny-by-default on sensitive tables. API roles cannot modify
-- settings/requests/grants/audit; only narrowly checked functions above can.
revoke all on function public.request_support_access(uuid,text,integer), public.decide_support_access(uuid,boolean), public.revoke_support_access(uuid), public.support_access_expiry(uuid,text), public.set_event_viewing_access(uuid,text) from public,anon;
grant execute on function public.request_support_access(uuid,text,integer), public.decide_support_access(uuid,boolean), public.revoke_support_access(uuid), public.support_access_expiry(uuid,text), public.set_event_viewing_access(uuid,text) to authenticated;
revoke all on function event_security.is_event_owner(uuid) from public,anon;
grant execute on function event_security.is_event_owner(uuid) to authenticated;
revoke all on function event_security.assign_first_host() from public,anon,authenticated;
revoke all on function public.sync_admin_primary_membership() from public,anon,authenticated;
alter function public.sync_admin_primary_membership() set search_path='';

create function public.record_support_media_issuance(eid uuid, media text, actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare g public.support_access_grants; r public.support_access_requests;
begin
 select sg.* into g from public.support_access_grants sg join public.events e on e.id=sg.event_id
 join public.admins a on a.id=sg.admin_user_id and a.role='owner'
 where sg.event_id=eid and sg.admin_user_id=actor and e.owner_user_id=sg.owner_user_id
 and sg.status='active' and sg.revoked_at is null and sg.starts_at<=clock_timestamp() and sg.expires_at>clock_timestamp()
 order by sg.expires_at desc limit 1 for update of sg;
 if g.id is null then return false; end if;
 select * into r from public.support_access_requests where id=g.request_id;
 insert into public.support_access_audit_log(request_id,grant_id,event_id,admin_user_id,owner_user_id,actor_user_id,action,reason,outcome,media_id)
 values(r.id,g.id,eid,actor,g.owner_user_id,actor,'signed_url_issued',r.reason,'allowed',left(media,200));
 return true;
end; $$;
revoke all on function public.record_support_media_issuance(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.record_support_media_issuance(uuid,text,uuid) to service_role;

create function public.pin_public_event(event_slug text, keep_public boolean)
returns void language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.admins where id=auth.uid() and role='owner') then raise exception 'Platform administrator required'; end if;
 if keep_public is null then raise exception 'Select a public-link setting'; end if;
 select id into eid from public.events where slug=event_slug for update;
 if eid is null then raise exception 'Event link not found'; end if;
 update public.events set public_access_pinned=keep_public,
 viewing_access=case when keep_public then 'public' else viewing_access end where id=eid;
 insert into public.event_privacy_changes(event_id,actor_user_id,action)
 values(eid,auth.uid(),case when keep_public then 'keep_public' else 'release_public_exception' end);
end; $$;
revoke all on function public.pin_public_event(text,boolean) from public,anon;
grant execute on function public.pin_public_event(text,boolean) to authenticated;
commit;
