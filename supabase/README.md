# supabase/

SQL migrations + seed data for the Supabase project backing this app.

## Setup

1. Create a Supabase project.
2. Run `migrations/0001_init.sql` in the SQL editor (or via `supabase db push`
   if you're using the Supabase CLI).
3. Run `seed.sql` to create the initial "Mahesh J. Shah's 75th Birthday"
   event row.
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose to the client)
5. Generate invitee tokens/links from the admin panel (Phase 5) or, for now,
   insert rows into `invitees` directly with a token from `lib/tokens.ts`.

All guest-facing reads/writes (RSVP, tracking) run server-side through the
service-role client in `lib/supabase/admin.ts`. RLS is enabled with no
public policies, so the anon key alone cannot read or write guest data —
the invite token is the guest's credential, checked in application code.

## Auth email templates (branding)

This is a hosted Supabase project (no `config.toml` checked in), so auth
email templates — the "Confirm your signup" email new admins/clients get
from `supabaseBrowser().auth.signUp()` — are NOT configured from code.
They default to generic Supabase wording ("Confirm your signup" from
`noreply@mail.app.supabase.io`) unless set in the Dashboard.

`templates/confirm-signup.html` in this folder is the source of truth for
the branded version — copy/paste it (and the subject below) into:

**Authentication → Email Templates → Confirm signup**
https://supabase.com/dashboard/project/ktbpnjrovzhjwardyime/auth/templates

Subject: `Confirm your email — Celebration Memories`

The Dashboard also lets you set a custom "Sender email/name" on paid plans
(Settings → Auth → SMTP) if you want the From address to say Celebration
Memories too, rather than Supabase's shared sender.
