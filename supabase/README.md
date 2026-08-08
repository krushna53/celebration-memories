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
| `confirm-signup.html` | Confirm signup | `Confirm your email — EveryMoment` |
| `invite-user.html` | Invite user | `You're invited to EveryMoment` |
| `magic-link.html` | Magic Link | `Your sign-in link — EveryMoment` |
| `reset-password.html` | Reset Password | `Reset your password — EveryMoment` |
| `change-email.html` | Change Email Address | `Confirm your new email — EveryMoment` |
| `reauthentication.html` | Reauthentication | `Your verification code — EveryMoment` |

All six share the same dark indigo / coral / cream look as the rest of
the site (rebranded from the old navy/gold/ivory "Celebration
Memories" look — see /EVERYMOMENT-BRAND.md), are table-based with
inline styles only (no external assets or fonts, for email client
compatibility), and end with the same "EveryMoment · Built by Krushna
Web Works" footer line.

**Now that the project is on a paid ("Pro") Supabase plan**, two more
branding levers open up beyond just the template body/subject, both under
**Settings → Auth → SMTP Settings**:

1. **Custom SMTP** — point auth email delivery at your own sender (e.g.
   Resend, the same provider `lib/email.ts` already uses for inquiry/
   notification emails) so the From address reads
   `EveryMoment <noreply@yourdomain.com>` instead of Supabase's shared
   `noreply@mail.app.supabase.io`. This also removes Supabase's
   free-tier rate limit on auth emails (a handful per hour).
2. **Sender name** — even without custom SMTP, the Pro plan lets you set
   a display name for the shared sender, so recipients see "EveryMoment"
   in their inbox rather than a raw Supabase address.

Neither of those two are template files — they're one-time Dashboard
settings, not something to check into this repo.

## Guest reminder push notifications (Web Push)

If a guest starts recording or picking a video/audio message on their
personal `/invite/[token]` page but never finishes uploading it, they
can opt in (a small inline prompt right on the upload screen — see
`features/push/notification-prompt.tsx`) to one real OS-level push
notification reminding them to finish, even if they've closed the site
entirely. This is separate from — and doesn't need — WhatsApp; it's a
standard Web Push (VAPID) notification delivered by the browser/OS,
free, no per-message cost.

**Nothing to configure by default** — like AI Image/AI CSS/Slideshow
Video, this degrades gracefully: with no VAPID keys set, the "remind
me" prompt just never appears, and the scheduled dispatch is a silent
no-op. To turn it on:

1. Generate a VAPID keypair once (any tool that produces a P-256 keypair
   works; `npx web-push generate-vapid-keys` is the standard one).
2. Add to your **Netlify** env vars (Site settings → Environment
   variables) — the public key is safe to expose to the browser, it's
   what the client needs to subscribe:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY` (server-only, never exposed to the browser)
   - `VAPID_SUBJECT` — a `mailto:` address or `https://` URL identifying
     the sender, required by the Web Push protocol (RFC 8292)
3. Set the same three as **Supabase Edge Function secrets** (Edge
   Functions don't read Netlify's env vars — separate config surface):
   **Edge Functions → Manage secrets**
   https://supabase.com/dashboard/project/ktbpnjrovzhjwardyime/settings/functions

Once all three are set in both places, guests start seeing the "remind
me" prompt, and the `guest-reminder-push-dispatch` pg_cron job (runs
once daily, 7:00 PM IST — see migration `0024_guest_reminder_cron.sql`
to change the time) starts actually sending.

**How it works, end to end:**
- A guest starting a video/audio recording or picking a file to upload
  logs a `{kind}_capture_started` row in `activity_logs` (see
  `hooks/use-media-upload.ts`'s `addFiles`) — no new table, reusing the
  existing activity/event log.
- If they opt in to reminders (subscribes via the browser's
  `pushManager`), the subscription is saved to `push_subscriptions`,
  keyed to their invitee id.
- A successful upload already logs `{kind}_uploaded` (existing
  behavior, `features/uploads/actions.ts`'s `confirmUpload`).
- `supabase/functions/send-reminder-push` finds invitees whose most
  recent `_capture_started` event is older than the event's
  `guest_reminder_delay_minutes` (default 60, editable in Event
  Settings → Guest Reminders) with no later `_uploaded` event and no
  later `reminder_sent_{kind}` event, and sends one push per matching
  subscription, then logs `reminder_sent_{kind}` so the same abandoned
  attempt is never reminded twice.
- Event Settings → Guest Reminders also has a manual **"Send reminders
  now"** button (`sendGuestRemindersNowAction`) for testing or catching
  up guests right before the event — it bypasses the on/off toggle.
- Scoped to invitee-token guests only (`/invite/[token]`) — the public,
  no-token `/events/[slug]/memories` flow has no stable per-guest
  identity to attach a subscription to.

**Known limitation:** this is Web Push (browser/PWA), not a native
push channel — it won't reach a guest through the Capacitor iOS/Android
app shell via APNs/FCM. Revisit if/when the native app ships to app
stores.
