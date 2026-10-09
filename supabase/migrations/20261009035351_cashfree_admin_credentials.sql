begin;
create table public.cashfree_credentials (
 id boolean primary key default true check(id),
 app_id text not null,
 secret_ciphertext text not null,
 environment text not null check(environment in ('sandbox','production')),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.cashfree_credentials enable row level security;
revoke all on public.cashfree_credentials from public,anon,authenticated;
grant all on public.cashfree_credentials to service_role;
comment on table public.cashfree_credentials is 'Server-only encrypted merchant credentials. No browser access policies.';
commit;
