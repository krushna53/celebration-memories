-- "reviewer" team role (2026-11-10).
--
-- A narrower team member than "client": can view RSVPs and RSVP reports
-- and approve or reject guest memories — nothing else (no settings,
-- invitee edits, design, AI tools or team management). Like organizer
-- and session_organizer it is a per-event membership role only;
-- admins.role stays 'client' for these logins (admins_role_check only
-- allows owner/client), and getCurrentAdmin() takes the role from the
-- membership of the event being managed.

alter table public.admin_event_memberships drop constraint if exists admin_event_memberships_role_check;
alter table public.admin_event_memberships
  add constraint admin_event_memberships_role_check
  check (role in ('client', 'organizer', 'session_organizer', 'reviewer'));

-- The primary-event mirror trigger used to overwrite the membership role
-- with admins.role on every write of admins.event_id/role. admins.role is
-- 'client' for a reviewer, so that would silently upgrade a reviewer to
-- full access. Keep an existing reviewer membership as reviewer; granting
-- full access is done explicitly by changing the membership row.
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
    on conflict (admin_id, event_id) do update
      set role = case
        when public.admin_event_memberships.role = 'reviewer' then 'reviewer'
        else excluded.role
      end;
  end if;
  return new;
end;
$$;
