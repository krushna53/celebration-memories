-- Only the platform owner may read these limited account activity fields.
-- Keep the auth-schema reader outside the exposed API schema.
create or replace function event_security.login_activity(page_offset integer, page_size integer)
returns table(id uuid, email text, name text, kinds text[], admin_role text,
              created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins a where a.id = auth.uid() and a.role = 'owner') then
    raise exception 'Only the platform owner can view login activity' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text,
      coalesce(a.name, b.name, f.name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')::text,
      array_remove(array[case when a.id is not null then 'admin' end,
                         case when b.id is not null then 'business' end,
                         case when f.id is not null then 'forms' end], null)::text[],
      a.role::text, u.created_at, u.last_sign_in_at
    from auth.users u
    left join public.admins a on a.id = u.id
    left join public.business_accounts b on b.id = u.id
    left join public.form_owners f on f.id = u.id
    order by u.last_sign_in_at desc nulls last, u.created_at desc, u.id
    limit least(greatest(page_size, 1), 1000) offset greatest(page_offset, 0);
end;
$$;
revoke all on function event_security.login_activity(integer, integer) from public, anon;
grant execute on function event_security.login_activity(integer, integer) to authenticated;

create or replace function public.list_login_activity(page_offset integer default 0, page_size integer default 1000)
returns table(id uuid, email text, name text, kinds text[], admin_role text,
              created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from event_security.login_activity(page_offset, page_size);
$$;
revoke all on function public.list_login_activity(integer, integer) from public, anon;
grant execute on function public.list_login_activity(integer, integer) to authenticated;
