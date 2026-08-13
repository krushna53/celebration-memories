-- Restricts handle_new_confirmed_admin() to only fire for genuine
-- host/event-registration signups, not every confirmed signup on the
-- shared Supabase Auth project.
--
-- Previously this trigger created a public.admins row (role='client',
-- event_id from raw_user_meta_data->>'draft_event_id', or null) for
-- ANY auth.users row whose email got confirmed — regardless of
-- whether the signup was actually a host registration
-- (features/admin/register/register-form.tsx,
-- features/start/account-form.tsx, both of which pass
-- draft_event_id), a Marketplace vendor signup
-- (features/business/signup-form.tsx), or a Build RSVP / Form owner
-- signup (features/forms/account-form.tsx) — neither of the latter
-- two ever sets draft_event_id, since they aren't creating an event
-- host account at all.
--
-- This went unnoticed while each product had its own login page that
-- only ever checked its own table (getCurrentBusinessAccount()/
-- getCurrentFormOwner()), so a stray admins row never mattered. Once
-- the shared /login page's resolveLoginDestinationAction() started
-- checking admin first (see features/auth/actions.ts), any vendor or
-- form-owner who had ever confirmed their email also had a spurious
-- admins row (role='client', event_id=null) — which won the priority
-- check, sent them to /admin, and then (per app/admin/(dashboard)/
-- page.tsx's existing "no event assigned" handling for client-role
-- admins) bounced them straight to /start instead of their actual
-- dashboard.
--
-- Fix: only insert when draft_event_id is present, i.e. only for the
-- two password-based host-signup flows that supply it. Google-OAuth
-- host signups (which can't set custom signUp() metadata — Google's
-- own profile data populates raw_user_meta_data instead) no longer
-- get their admins row from this trigger; app/auth/callback/route.ts's
-- `link_event_id` branch now creates that row explicitly instead (see
-- that file's updated comment).
create or replace function public.handle_new_confirmed_admin()
returns trigger
language plpgsql
security definer
as $function$
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null)
     and new.raw_user_meta_data ->> 'draft_event_id' is not null
  then
    insert into public.admins (id, email, name, role, event_id)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      'client',
      nullif(new.raw_user_meta_data ->> 'draft_event_id', '')::uuid
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$function$;
