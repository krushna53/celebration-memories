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
email templates are NOT configured from code — they default to generic
Supabase wording (e.g. "Confirm your signup" from
`noreply@mail.app.supabase.io`) unless set in the Dashboard.

Every file in `templates/` is the branded source of truth for one auth
email — copy/paste each one's body (and the subject listed in its own
header comment) into the matching Dashboard page:

**Authentication → Email Templates**
https://supabase.com/dashboard/project/ktbpnjrovzhjwardyime/auth/templates

| Template file | Dashboard page | Subject |
| --- | --- | --- |
| `confirm-signup.html` | Confirm signup | `Confirm your email — Celebration Memories` |
| `invite-user.html` | Invite user | `You're invited to Celebration Memories` |
| `magic-link.html` | Magic Link | `Your sign-in link — Celebration Memories` |
| `reset-password.html` | Reset Password | `Reset your password — Celebration Memories` |
| `change-email.html` | Change Email Address | `Confirm your new email — Celebration Memories` |
| `reauthentication.html` | Reauthentication | `Your verification code — Celebration Memories` |

All six share the same dark navy / gold / ivory look as the rest of the
site, are table-based with inline styles only (no external assets or
fonts, for email client compatibility), and end with the same
"Celebration Memories · Built by Krushna Web Works" footer line.

**Now that the project is on a paid ("Pro") Supabase plan**, two more
branding levers open up beyond just the template body/subject, both under
**Settings → Auth → SMTP Settings**:

1. **Custom SMTP** — point auth email delivery at your own sender (e.g.
   Resend, the same provider `lib/email.ts` already uses for inquiry/
   notification emails) so the From address reads
   `Celebration Memories <noreply@yourdomain.com>` instead of Supabase's
   shared `noreply@mail.app.supabase.io`. This also removes Supabase's
   free-tier rate limit on auth emails (a handful per hour).
2. **Sender name** — even without custom SMTP, the Pro plan lets you set
   a display name for the shared sender, so recipients see "Celebration
   Memories" in their inbox rather than a raw Supabase address.

Neither of those two are template files — they're one-time Dashboard
settings, not something to check into this repo.
