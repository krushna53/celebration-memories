-- Deploy before the application. Legacy submissions keep NULL notice versions.
create table public.consent_notices (
  version text not null,
  purpose text not null check (purpose in ('rsvp', 'guestbook')),
  notice text not null,
  primary key (version, purpose)
);
insert into public.consent_notices values
('2026-10-30.1', 'rsvp', 'I agree to the host storing and using my name, contact details and RSVP answers to plan this event. Optional analytics and face matching require separate choices.'),
('2026-10-30.1', 'guestbook', 'I agree to my name, message and optional photo being stored and published on this event''s Memory Wall for its audience.');

alter table public.rsvps add column consent_version text;
alter table public.guestbook add column consent_version text;
create table public.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  invitee_id uuid not null,
  purpose text not null,
  notice_version text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key (notice_version, purpose) references public.consent_notices(version, purpose)
);
-- No contact information, tokens or answers are copied into receipts.
-- No cascading foreign key: erasing a submission must not silently erase evidence.
create index consent_receipts_subject on public.consent_receipts(invitee_id, recorded_at);
create function public.capture_submission_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.consent_version is null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.consent_at is not distinct from old.consent_at then return new; end if;
  end if;
  if new.consent_at is null then raise exception 'Consent timestamp required'; end if;
  insert into public.consent_receipts(source_id, invitee_id, purpose, notice_version)
  values (new.id, new.invitee_id, case when tg_table_name = 'rsvps' then 'rsvp' else 'guestbook' end, new.consent_version);
  return new;
end; $$;
revoke all on function public.capture_submission_consent() from public, anon, authenticated, service_role;
create trigger rsvp_consent_receipt after insert or update on public.rsvps for each row execute function public.capture_submission_consent();
create trigger guestbook_consent_receipt after insert or update on public.guestbook for each row execute function public.capture_submission_consent();

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 254),
  event_label text not null check (length(event_label) between 2 and 160),
  kind text not null check (kind in ('access','correction','erasure','withdrawal','grievance','nomination')),
  details text not null check (length(details) between 10 and 2000),
  ip_hash text not null,
  status text not null default 'received' check (status in ('received','verifying','in_progress','completed','rejected')),
  verification text not null default '',
  review_note text not null default '',
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index privacy_requests_rate on public.privacy_requests(ip_hash, created_at);
create table public.privacy_request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.privacy_requests(id),
  status text not null,
  note text not null,
  actor_id uuid not null,
  verification text not null,
  recorded_at timestamptz not null default now()
);

create function public.submit_privacy_request(p_email text, p_event text, p_kind text, p_details text, p_ip_hash text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare request_id uuid;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'Rate limit identity required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 631));
  if (select count(*) from public.privacy_requests where ip_hash = p_ip_hash and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Request limit reached';
  end if;
  insert into public.privacy_requests(email,event_label,kind,details,ip_hash)
  values (p_email,p_event,p_kind,p_details,p_ip_hash) returning id into request_id;
  return request_id;
end; $$;
revoke all on function public.submit_privacy_request(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_privacy_request(text,text,text,text,text) to service_role;

create function public.review_privacy_request(p_id uuid, p_expected text, p_status text, p_note text, p_verification text, p_actor uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.privacy_requests;
begin
  if not exists(select 1 from public.admins where id = p_actor and role = 'owner') then raise exception 'Platform administrator required'; end if;
  select * into r from public.privacy_requests where id = p_id for update;
  if not found or r.status <> p_expected then raise exception 'Request changed; refresh before reviewing'; end if;
  if not ((r.status = 'received' and p_status in ('verifying','rejected')) or
          (r.status = 'verifying' and p_status in ('in_progress','rejected')) or
          (r.status = 'in_progress' and p_status in ('completed','rejected'))) then raise exception 'Invalid status transition'; end if;
  if p_note is null or length(trim(p_note)) not between 10 and 2000 then raise exception 'Review note required'; end if;
  if length(coalesce(p_verification,'')) > 1000 then raise exception 'Verification note too long'; end if;
  if p_status in ('in_progress','completed') and length(trim(coalesce(p_verification,''))) < 10 then raise exception 'Identity verification record required'; end if;
  update public.privacy_requests set status = p_status, review_note = p_note,
    verification = coalesce(p_verification,''), reviewed_by = p_actor, updated_at = now() where id = p_id;
  insert into public.privacy_request_history(request_id,status,note,actor_id,verification) values(p_id,p_status,p_note,p_actor,coalesce(p_verification,''));
end; $$;
revoke all on function public.review_privacy_request(uuid,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.review_privacy_request(uuid,text,text,text,text,uuid) to service_role;

alter table public.consent_notices enable row level security;
alter table public.consent_receipts enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.privacy_request_history enable row level security;
revoke all on public.consent_notices, public.consent_receipts, public.privacy_requests, public.privacy_request_history from public, anon, authenticated, service_role;
grant select on public.consent_notices, public.consent_receipts to service_role;
grant select, insert, update on public.privacy_requests to service_role;
grant select, insert on public.privacy_request_history to service_role;
