# Celebration Memories

Premium, multi-event digital invitation & memory-sharing platform.
First event: **Mahesh J. Shah's 75th Birthday Celebration**, hosted by
**Jagruti Shah**.

See `CLAUDE.md` in the project root for the full product spec and phased
delivery plan.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase ·
Framer Motion · GSAP.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

See `supabase/README.md` for how to provision the database (migrations +
seed data).

## Deployment

Deploys to **Netlify** via `@netlify/plugin-nextjs` (see `netlify.toml`).
Set the same three Supabase env vars from `.env.example` in Netlify's
site settings (Site configuration → Environment variables), then trigger
a new deploy.

## Status

All 6 phases from CLAUDE.md are implemented:

- **Phase 1** — project setup, theme, layout, navigation, hero, footer.
- **Phase 2** — Countdown, Invitation, Event Details, Gallery, Timeline,
  RSVP-teaser sections, all with scroll-in animations.
- **Phase 3** — Supabase schema, unique per-guest invite tokens, the
  `/invite/[token]` guest page with automatic identification + visit
  tracking, and a full RSVP form wired to a Server Action.
- **Phase 4** — guest photo/video/audio uploads, guestbook, and the
  public Memory Wall. See "Where guests upload" below.
- **Phase 5** — admin dashboard: overview + analytics, invitee
  management (create/edit/delete, CSV import, WhatsApp send), memory
  moderation, and event-day check-in. See "Admin access" below.

Mobile responsiveness has been reviewed across every section (touch
target sizing, stacked layouts on narrow viewports, no horizontal
overflow).

### Where guests upload — and how easy it is

Every guest reaches uploads through their own personal invite link —
`/invite/<token>` — the same page as their RSVP. No account, no app
download, no separate link to find. Scrolling past the RSVP form, guests
hit two sections:

- **Share Your Memories** — a three-tab picker (Photos / Video / Audio).
  Tapping a tab shows one big dashed drop-zone button ("Tap to choose
  photos/a video/an audio file"); for video and audio there's also a
  "Record instead" toggle that opens the camera/mic right in the browser
  (no extra app). Each picked or recorded file gets a queue row with an
  optional caption field, then one "Upload All" button sends everything.
- **Guest Book** — name, a message, optional country, optional single
  photo — a plain form, no upload complexity.

Technically: photos are compressed client-side (resized + re-encoded to
JPEG) before upload to keep the request small on mobile data; every file
then goes straight from the guest's browser to Supabase Storage via a
short-lived signed URL (nothing large ever passes through a server
function, which matters on Netlify's payload limits). Every upload sits
in a moderation queue (`approved = false`) until an admin approves it on
`/admin/memories` — nothing a guest submits appears publicly on its own.

### Admin access

The dashboard lives at `/admin` and is protected by Supabase Auth plus
an `admins` allowlist table — being signed in isn't enough on its own,
the account must also have a row in `admins`. To create your first admin:

1. In the Supabase dashboard: **Authentication → Users → Add user** —
   create yourself an account with an email + password.
2. Run this in the SQL Editor (swap in your email):
   ```sql
   insert into admins (id, email, name)
   select id, email, 'Your Name' from auth.users where email = 'you@example.com';
   ```
3. Sign in at `/admin/login`.

From there: **Overview** (RSVP breakdown, upload counts, most active
guests), **Invitees** (create/edit/delete, CSV import with
`name,phone,email,relationship` columns, copy invite link, one-tap
WhatsApp send), **Memories** (approve/feature/delete guest uploads —
defaults to showing only what's pending review), **Check-In** (search +
tap to check a guest in on event day).

### Content still needed before launch

- **Venue** — fill in `lib/constants.ts` → `VENUE` (name, address, Google
  Maps embed/directions URLs, parking, dress code). The Event Details
  section shows "to be announced" placeholders until then.
- **Gallery photos** — add entries to
  `features/gallery/gallery-data.ts` and drop the corresponding images
  under `public/gallery/<category>/`. Empty categories show a "coming
  soon" state. (Separate from guest uploads/Memory Wall, which are
  already live.)
- **Timeline** — `features/timeline/timeline-data.ts` currently has
  placeholder life-stage milestones; replace with real dates/stories.
- **Admin account** — see "Admin access" above; nobody can reach
  `/admin` until you create one.
- **Invitees** — either add them one at a time from `/admin/invitees`,
  or bulk-import via CSV.

### Known limitations

- Video/audio files upload as-is (not compressed client-side) — only
  photos are compressed before upload. Compressing video in-browser
  would need a much heavier tool (ffmpeg.wasm); out of scope for now.
- The per-guest upload cap (40 files) and moderation queue are the main
  abuse safeguards — there's no CAPTCHA or IP-based rate limiting.
- Deleting an invitee cascades to their RSVP/uploads/activity — there's
  a confirm dialog, but no undo.
