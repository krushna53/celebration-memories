-- Security fix (2026-10-06): the email sign-up trigger made the new user
-- the host of whatever event id was in their sign-up metadata
-- (raw_user_meta_data.draft_event_id) — a value the person signing up
-- controls. Anyone who learned an event's id could sign up and gain its
-- dashboard. Now only an unclaimed wizard draft (status 'draft', with no
-- host yet) can be linked this way, which is the only legitimate use
-- (the /start wizard's account step). Same rule as the Google sign-in
-- callback (app/auth/callback/route.ts).

create or replace function public.handle_new_confirmed_admin()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event_id uuid;
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null)
     and new.raw_user_meta_data ->> 'draft_event_id' is not null
  then
    begin
      v_event_id := nullif(new.raw_user_meta_data ->> 'draft_event_id', '')::uuid;
    exception when others then
      v_event_id := null;
    end;

    if v_event_id is not null
       and exists (select 1 from public.events e where e.id = v_event_id and e.status = 'draft')
       and not exists (select 1 from public.admin_event_memberships m where m.event_id = v_event_id)
       and not exists (select 1 from public.admins a where a.event_id = v_event_id)
    then
      insert into public.admins (id, email, name, role, event_id)
      values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
        'client',
        v_event_id
      )
      on conflict (id) do nothing;
    end if;
  end if;
  return new;
end;
$function$;
