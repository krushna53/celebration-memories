-- Disposable Postgres fixture mirroring only columns used by this migration.
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key);
create table public.events(id uuid primary key, slug text, status text default 'active',page_status text default 'published');
create table public.admins(id uuid primary key references auth.users(id),role text);
create table public.admin_event_memberships(admin_id uuid references public.admins(id),event_id uuid references public.events(id),role text,created_at timestamptz default now());
create table public.invitees(id uuid primary key,event_id uuid,email text);
create table public.admin_notifications(id uuid default gen_random_uuid(),admin_id uuid,event_id uuid,type text,title text,body text,link text);
create function public.sync_admin_primary_membership() returns trigger language plpgsql security definer as $$ begin return new; end; $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
insert into auth.users select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,5) i;
insert into public.admins select id,case when id::text like '%001' or id::text like '%002' then 'owner' else 'client' end from auth.users;
insert into public.events(id,slug) values
 ('10000000-0000-4000-8000-000000000001','75th-birthday-mahesh-shah'),
 ('10000000-0000-4000-8000-000000000002','veda-s-1st-birthday'),
 ('10000000-0000-4000-8000-000000000003','mgm-medical-college-53rd-reunion-batch-73'),
 ('10000000-0000-4000-8000-000000000004','test-private');
insert into public.admin_event_memberships(admin_id,event_id,role) values
 ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','client'),
 ('00000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','client');
