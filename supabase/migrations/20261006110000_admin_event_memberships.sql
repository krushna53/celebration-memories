-- One login, many events (2026-10-06).
--
-- Until now every non-owner admin was tied to exactly one event through
-- admins.event_id, so a host couldn't run a second event and a person
-- couldn't be added to two teams ("This person already manages another
-- event"). admin_event_memberships is now the source of truth for which
-- events a non-owner admin can manage, and with which role on each.
-- The platform owner (admins.role = 'owner') stays global and needs no rows.
--
-- admins.event_id is kept as the person's "primary" event (what the
-- mobile app and a few older paths read). A trigger mirrors every write
-- of it into a membership row, so existing provisioning paths (sign-up
-- trigger, team invites, organizer invites, the wizard) keep working
-- unchanged and automatically create memberships.

create table if not exists public.admin_event_memberships (
  admin_id uuid not null references public.admins(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'organizer', 'session_organizer')),
  created_at timestamptz not null default now(),
  primary key (admin_id, event_id)
);

create index if not exists admin_event_memberships_event_idx on public.admin_event_memberships (event_id);

-- Server-side only (service role); no public policies, same as admins.
alter table public.admin_event_memberships enable row level security;

-- Backfill every existing non-owner admin's single event.
insert into public.admin_event_memberships (admin_id, event_id, role)
select id, event_id, case when role in ('client', 'organizer', 'session_organizer') then role else 'client' end
from public.admins
where role <> 'owner' and event_id is not null
on conflict (admin_id, event_id) do nothing;

create or replace function public.sync_admin_primary_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'owner' and new.event_id is not null then
    insert into public.admin_event_memberships (admin_id, event_id, role)
    values (
      new.id,
      new.event_id,
      case when new.role in ('client', 'organizer', 'session_organizer') then new.role else 'client' end
    )
    on conflict (admin_id, event_id) do update set role = excluded.role;
  end if;
  return new;
end;
$$;

drop trigger if exists admins_sync_primary_membership on public.admins;
create trigger admins_sync_primary_membership
after insert or update of event_id, role on public.admins
for each row execute function public.sync_admin_primary_membership();

-- Deleting an event must no longer delete a host's whole account — they
-- may run other events. The membership cascades away; the primary
-- pointer just clears. (Account clean-up for people left with no events
-- happens in application code — services/admin-danger-zone.ts.)
alter table public.admins drop constraint if exists admins_event_id_fkey;
alter table public.admins
  add constraint admins_event_id_fkey foreign key (event_id) references public.events(id) on delete set null;
