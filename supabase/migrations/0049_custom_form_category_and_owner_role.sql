-- Custom Form Builder: "RSVP instance" occasion category on each form
-- (drives the /forms/new wizard's step 1 + starter-field pre-fill +
-- AI-generation context, see lib/form-category.ts), and a role on
-- form_owners so an account can optionally view only RSVP-category
-- forms on their dashboard.

alter table custom_forms
  add column if not exists category text;

alter table custom_forms
  add constraint custom_forms_category_check
  check (category is null or category in (
    'wedding', 'birthday', 'baby_shower', 'anniversary', 'retirement', 'corporate', 'reunion', 'general'
  ));

alter table form_owners
  add column if not exists role text not null default 'owner';

alter table form_owners
  add constraint form_owners_role_check
  check (role in ('owner', 'rsvp'));
