# Celebration Memories

Premium, multi-event digital invitation & memory-sharing platform.
First event: **Mahesh J. Shah's 75th Birthday Celebration**, hosted by
**Jagruti Shah** — though as of this update, all of that is editable
from the admin dashboard rather than hardcoded. See "Admin content
management" below.

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

All 6 phases from CLAUDE.md are implemented, plus a full admin content
management layer on top:

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
  moderation, and event-day check-in.
- **Content management** — Event Settings, Gallery, and Timeline are now
  all admin-editable and pulled live from Supabase (no more hardcoded
  content files for these). See "Admin content management" below.
- **Public/platform pages** — a generic `/events/[slug]` page for any
  event, a public `/events` directory (opt-in via visibility), and a
  `/platform` marketing page for the platform itself. See "Platform-level
  pages" below.
- **Templates, GDPR, referrals & admin tools** — a config-driven template
  registry with 5 themes, an occasion-date field, admin media download,
  a shareable invitation-image generator, guest consent capture, a
  referral-link program, and a Contact Us inbox. See "Templates" and
  "Round 3 additions" below.

Mobile responsiveness has been reviewed across every section (touch
target sizing, stacked layouts on narrow viewports, no horizontal
overflow).

### Admin content management

Everything that used to be hardcoded in source files is now editable
from `/admin` and reflected on the public site within about a minute
(the homepage revalidates every 60s):

- **Event Settings** (`/admin/event-settings`) — Hosted For (honoree
  name), Hosted By, Occasion (e.g. "75th Birthday Celebration"),
  Tagline (the poetic subtitle, e.g. "75 Years of Love"), start/end
  date & time, venue name/address, Google Maps directions + embed URLs,
  parking info, dress code, **visibility** (Public/Private), and a short
  description used on the public directory card. These drive the Hero,
  Countdown, Invitation, and Event Details sections everywhere on the
  public site, plus the personalized invite pages.
- **Gallery** (`/admin/gallery`) — upload photos straight from the
  browser (compressed client-side, same signed-upload pipeline as guest
  uploads) into one of the six categories (Childhood, Wedding, Family,
  Friends, Travel, Grandchildren). Shows up immediately in the public
  Gallery section's category filters.
- **Timeline** (`/admin/timeline`) — add/remove/reorder life-story
  milestones (period, title, description) with up/down arrows. The
  public Timeline section only renders once at least one milestone
  exists.

This is separate from guest-submitted content: the **Memories** page
still moderates what guests upload via their invite links (Memory
Wall), while **Gallery** and **Timeline** are strictly admin-curated —
guests never see an edit control for either.

### Platform-level pages

Alongside any individual event's site, there are three pages that sit
above the event level:

- **`/`** — the site's primary event (whichever event has slug
  `EVENT_SLUG` in `lib/constants.ts`; currently the Mahesh J. Shah
  birthday). Unchanged behavior from before.
- **`/events/[slug]`** — the same Hero-through-Memory-Wall experience as
  `/`, but for *any* event by its slug. This is what makes the platform
  genuinely multi-event: every event gets its own shareable URL. Works
  for both public and private events — `visibility` only controls the
  directory listing below, not whether the link itself works (same
  trust model as a per-guest invite link).
- **`/events`** — a public directory listing every event with
  `visibility = "public"`, as cards with a cover photo (first uploaded
  gallery photo), category badge, date, and venue. Private events never
  appear here. Toggle an event's visibility from its Event Settings page.
- **`/platform`** — a marketing page for Celebration Memories itself
  (distinct from any one event), aimed at someone who wants to build
  their own event site. Lists what's live today and what's on the
  roadmap (color themes/templates, AI-assisted design), with a WhatsApp
  CTA to Krushna Web Works. Linked from the footer on every page.

### Templates

Every event picks a visual template from `/admin/templates` — the
registry lives entirely in `lib/template-catalog.ts` (metadata: name,
description, category, free/premium + price, thumbnail) and
`lib/templates.ts` (pairs each slug with its dynamically-imported
component). Nothing hardcodes a template list or switches on slug with
if/else — every surface reads from these two files, so adding template
#6 only means: a new `/templates/<Name>/{index.tsx,theme.ts}` folder, one
new entry in `TEMPLATE_CATALOG`, one new line in the `COMPONENTS` map.

All 5 shipped templates (Royal Gold, Floral Pastel, Minimal White, Kids
Cartoon, Neon Party) render the *exact same* Hero → Memory Wall section
stack (`features/event-landing/event-sections.tsx`) — only colour
palette, font pairing, and a named "animation personality" differ,
applied by overriding the same CSS custom properties
`app/globals.css` declares (see
`templates/shared/template-theme-wrapper.tsx`). No section component
knows templates exist. Kids Cartoon and Neon Party are marked premium
with a price (₹499 / ₹599) as pricing metadata only — no checkout is
wired up yet (see the Business & Growth guide for the recommended
Razorpay path).

### Round 3 additions

- **Occasion Date** — Event Settings now has an optional "Actual
  Occasion Date" separate from the celebration's start/end time (e.g. a
  real birthdate that differs from the party date). Shown on the public
  site as an extra detail card when set.
- **Admin media download** — `/admin/memories` has a "Download All
  Media (.zip)" button (`/api/admin/media-export`) that bundles every
  photo/video/audio upload for backup. In-memory zip — fine at family-
  event scale, flagged in `docs/risk-analysis.md` as needing a
  background-job rewrite at real volume.
- **Shareable invitation image** — `/admin/share-image` composes a
  downloadable PNG invitation card (Canvas-based, optionally using an
  uploaded photo as background), with a Share button that uses the Web
  Share API on mobile (falls back to opening WhatsApp with just the
  text+link, since browsers can't attach a file into a WhatsApp message
  programmatically).
- **GDPR-style consent** — RSVP and Guest Book both require a consent
  checkbox before submitting, timestamped as `consent_at` on the row. A
  `/privacy` page explains what's collected and why, linked from every
  footer.
- **Referrals** — `/admin/referrals` generates shareable
  `/platform?ref=<code>` links, tracks visits automatically, and lets
  the admin manually log conversions + reward amounts with a
  pending/paid toggle. Deliberately no automated payout — see the
  Business & Growth guide for why a manual step is the right call here.
- **Contact Us** — a public `/contact` form (name/email/message) writes
  to an `inquiries` table; `/admin/inquiries` lists and marks them read.
- **How-to guides** — `/admin/help` (every admin feature, including how
  to send a guest's unique invite link) and `/guide` (what a visitor can
  do), both linked from their respective navigation.
- **Support / Contribute** — a link on `/platform` (`SUPPORT.url` in
  `lib/constants.ts`) currently opens WhatsApp; swap it for a UPI or
  Razorpay Payment Link once one exists (steps in the Business & Growth
  guide).
- **`docs/risk-analysis.md`** — where the platform breaks first as
  traffic/media volume grow, and the concrete safeguard for each.
- **`docs/business-growth-guide.md`** — Razorpay account setup, India/
  foreign pricing recommendations, a "build free, pay to publish" gating
  pattern for monetization, GoDaddy→Netlify custom domain steps, and
  positioning advice for standing out as a real product rather than "an
  AI demo."

### Sharing media to Instagram/Facebook/X/etc

There's no web API any of those platforms expose for posting content
directly from a website — that's a platform limitation, not something
this app can route around. What actually works, and what's built:

- **Every uploaded photo is normalized to JPEG**, including iPhone HEIC
  photos (converted client-side via `heic2any` before the existing
  resize/compress step in `lib/image-compression.ts`). Chrome, Firefox,
  and most social upload flows can't reliably handle raw HEIC — this was
  silently producing photos guests could see on their own iPhone but
  nowhere else. Now everything that lands in Storage is a normal JPEG.
- **Download + Share buttons** on every Memory Wall and Gallery photo/
  video (`components/media/media-share-buttons.tsx`). Download fetches
  the file and forces a save (works even though the file lives on a
  different domain in Supabase Storage). Share uses the Web Share API
  with the actual file attached — on a phone, that opens the native OS
  share sheet, the same one Instagram/Facebook/WhatsApp/etc register
  into, so a guest can often post straight from there. Desktop browsers
  mostly don't support sharing files this way, so Share falls back to
  Download there.
- **Rich link previews** — `/` and `/events/[slug]` now generate real
  Open Graph + Twitter Card metadata per event (`lib/event-metadata.ts`),
  using the event's first gallery photo as the preview image. Pasting
  the event link into Facebook, X, WhatsApp, or iMessage now shows an
  actual photo and the honoree's name instead of a generic card.

Not solved, and not solvable from a website: HEVC-encoded `.mov` videos
from iPhone can still have inconsistent playback in some browsers before
a guest downloads them — once downloaded, native apps (including
Instagram's own uploader) handle that format fine, so it's a viewing
quirk on this site, not a sharing blocker.

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
guests), **Event Settings**, **Invitees** (create/edit/delete, CSV
import with `name,phone,email,relationship` columns, copy invite link,
one-tap WhatsApp send), **Gallery**, **Timeline**, **Memories**
(approve/feature/delete guest uploads — defaults to showing only what's
pending review), **Check-In** (search + tap to check a guest in on
event day).

Recommended: Supabase's "Leaked Password Protection" is off by default
on new projects. Turn it on under Authentication → Policies / Auth
settings in the dashboard — it checks new passwords against known
breach lists at no extra cost.

### Admin roles: owner vs. client

Every row in `admins` has a `role` of either `owner` or `client`. This
lets Krushna Web Works hand an event host their own admin login without
exposing agency-only surfaces (guest list/phone numbers, referral
payouts, contact inquiries, event-day check-in, bulk media export).

| | `owner` (you) | `client` (the event host) |
|---|---|---|
| Overview | ✅ | ✅ |
| Event Settings | ✅ | ✅ |
| Templates | ✅ | ✅ |
| Gallery | ✅ | ✅ |
| Timeline | ✅ | ✅ |
| Memories (moderation) | ✅ | ✅ |
| Invitees, Check-In, Referrals, Inquiries, Share Image, media export | ✅ | ❌ (redirected to `/admin`) |

There are two ways to create a client account for a host:

**Self-registration (recommended)** — send them `/admin/register`. They
fill in their name, email, and a password, and Supabase emails them a
verification link. Nothing happens until they click it: a database
trigger (`auto_admin_on_email_confirm` migration) only creates their
`admins` row — always with `role = 'client'` — the moment
`auth.users.email_confirmed_at` gets set. An unverified signup has a
Supabase Auth account but no `admins` row, so `/admin/login` just
bounces them back with no dashboard access. This means anyone who finds
`/admin/register` *can* create an account and become a client admin for
the active event once they verify their email — there's no invite
step gating who's allowed to register. If you'd rather pre-approve
specific people, use the manual SQL method below instead and don't
publicize the register link.

⚠️ This depends on Supabase's **Confirm email** setting being ON
(Authentication → Providers → Email in the Supabase dashboard — it's
the default for new projects, but worth double-checking). If it's off,
signups get a session immediately without verifying anything, and the
trigger fires right away.

**Manual (SQL)** — for pre-approving a specific person, or creating
another owner account:

1. **Authentication → Users → Add user** in Supabase.
2. In the SQL Editor:
   ```sql
   insert into admins (id, email, name, role)
   select id, email, 'Host Name', 'client' from auth.users where email = 'host@example.com';
   ```

Either way, once they're in: send them the `/admin/login` URL. Their
sidebar will only show the allowed pages, and a "Host access" badge
appears in the dashboard header so it's clear which mode they're in.

The allow-list itself lives in `lib/admin-roles.ts` (`CLIENT_ALLOWED_PATHS`)
if you ever want to open up or restrict a different page. Enforcement is
three layers deep on purpose — nav visibility, a redirect guard on each
restricted page, and a `requireOwner()` check inside every owner-only
Server Action/route — so a client account can't reach restricted data
even by guessing a URL or replaying a form submission.

### WhatsApp invites: custom message + bulk sending

**Custom message wording** — Event Settings has a "WhatsApp Invite
Message" field. Leave it blank for the default wording, or write your
own using `{{name}}`, `{{link}}`, `{{hostedBy}}`, `{{honoreeName}}`
placeholders (a live preview shows exactly what a guest will see).

**Bulk sending** — WhatsApp's `wa.me` links only support one contact at
a time; there's no way to fire a true one-tap "send to everyone" without
the paid WhatsApp Business API and Meta template approval (see the
Business & Growth guide for that path if volume ever justifies it). The
Invitees page's **Bulk Send** button opens a queue instead: it lists
guests with a phone number who haven't been sent an invite yet, and each
tap opens WhatsApp pre-filled for that guest, marks them sent, and
advances to the next — quick tapping-through rather than true
automation. There's also a **Copy all links as text** option for admins
who'd rather paste into their own broadcast list. A "Not sent / Sent"
column tracks who's been reached from the dashboard (best-effort — it
records when the admin opened WhatsApp, not a delivery receipt).

### Public RSVP (no personal invite link)

By default, RSVP only works through a guest's personal `/invite/[token]`
link. If collecting phone/email for every guest ahead of time isn't
practical, turn on **Public RSVP Link** in Event Settings — this opens
`/events/[slug]/rsvp`, a self-service form anyone with the link can use.
Guests are matched to an invitee record by phone number (digits-only,
so formatting doesn't matter), so returning to the same page with the
same number lets them edit their RSVP instead of creating a duplicate.

Trade-offs versus personal links, worth knowing before turning it on:
no per-guest open/visit tracking (there's nothing to track before they
show up), and a mistyped phone number could in theory edit someone
else's response. It's a reasonable default for informal or large-list
events; personal links remain the more precise option and both can be
used side by side — invitees created through either path show up
together on `/admin/invitees`.

### Optional integrations: analytics + email

**Microsoft Clarity** (heatmaps + session recordings — see where visitors
hesitate or give up) — create a free project at clarity.microsoft.com,
copy its project ID, and set `NEXT_PUBLIC_CLARITY_PROJECT_ID` in your
env. Leave it blank to skip; the site works identically either way.

There's also a self-hosted, no-account-needed **Visitor Funnel** on the
admin Overview page — page views → engaged with the RSVP form →
submitted, plus a completion rate. It's a numbers-only view (nothing
visual); Clarity is what shows the *why* behind a drop-off, this just
shows *how many*. It works from day one without any setup, tracked via
`activity_logs` (see services/tracking.ts).

**Resend** (transactional email — admin notification on new Contact Us
inquiries, RSVP confirmation to guests who provide an email) — create a
free account at resend.com, get an API key, and set:
```
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Celebration Memories <notifications@yourdomain.com>
ADMIN_NOTIFICATION_EMAIL=you@example.com
```
Landing in the inbox instead of spam is mostly about **domain
verification** (SPF/DKIM/DMARC), not the provider — Resend's dashboard
walks you through adding those DNS records for your own domain. Their
shared `onboarding@resend.dev` sender works for testing but is more
likely to get filtered; verify your own domain before relying on this
for real guest-facing email. Leave `RESEND_API_KEY` unset to skip
sending email entirely — inquiries still land on `/admin/inquiries`
either way.

### AI Image (optional, owner-only)

`/admin/ai-image` generates an image from a text description using
OpenAI's image API — for a link preview image, a gallery photo, or just
inspiration for a printed invitation. Available to both owner and
client accounts. Because it costs real money per image and there's no
billing pass-through to clients yet, client-role admins are capped at
`events.ai_image_generation_limit` (default 5) generations per event —
the owner is exempt. Raise or lower it per event with:
```sql
update events set ai_image_generation_limit = 30 where slug = 'your-event-slug';
```

**Getting an API key** (you do this yourself — account creation and
billing setup aren't something Claude can do on your behalf):
1. Go to platform.openai.com and sign up / log in.
2. Add a payment method under **Settings → Billing** — image generation
   is pay-per-use, there's no free tier.
3. Go to **Settings → API Keys → Create new secret key**, copy it
   immediately (it's only shown once).
4. Set `OPENAI_API_KEY` in your env to that key.

Leave it unset and `/admin/ai-image` shows a "not configured" message
instead of erroring — everything else on the site works identically
either way.

**Cost** (mid-2026 pricing, subject to change): roughly $0.02–$0.19 per
image depending on quality/size. Model defaults to `gpt-image-2`;
override with `OPENAI_IMAGE_MODEL` if OpenAI ships something newer.

**How generation actually runs:** OpenAI's image API routinely takes
30–60s+, which is longer than Netlify's synchronous function limit (10s
on the free plan). So the "Generate Image" button doesn't call OpenAI
directly — it creates a row in `ai_image_jobs` and triggers a Netlify
**Background Function** (`netlify/functions/generate-ai-image-background.mts`,
up to 15 minutes, available on every Netlify plan including free) to do
the actual OpenAI call and Storage upload. The browser polls
`getAiImageJobStatusAction` every ~2.5s until the job is `done` or
`error`. This is why `netlify/functions/` exists alongside the Next.js
app — it's a standalone function outside the `@netlify/plugin-nextjs`
build, deliberately kept free of `@/...` path-alias imports since
Netlify's function bundler doesn't resolve this project's `tsconfig.json`
paths (see the comment at the top of that file). Nothing here needs new
environment variables beyond `OPENAI_API_KEY` above — the background
function reads the same `NEXT_PUBLIC_SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` already configured for the rest of the site.

**Testing this locally:** Background Functions only run in Netlify's
own runtime — plain `next dev` won't serve
`netlify/functions/generate-ai-image-background.mts` at all, so the job
will sit at "pending" forever in local dev. Use the Netlify CLI's
`netlify dev` instead (`npm i -g netlify-cli`, then `netlify dev` from
the project root), and set `NEXT_PUBLIC_SITE_URL` to whatever it prints
(typically `http://localhost:8888`) so the Server Action's fetch call
reaches the right place.

### Domain Search (optional)

`/admin/domain-search` lets a client search for a custom domain for
their event (e.g. `mahesh75.com`) and see live availability + pricing
via GoDaddy's API. This platform can't process the purchase itself —
GoDaddy only allows programmatic *purchase* for API Reseller accounts,
a separate approval process requiring a funded balance — so each result
links out to GoDaddy's own checkout instead. Once a client owns a
domain, point its DNS at Netlify (Netlify docs → Custom domains) to use
it for their event.

**Getting an API key:**
1. Go to developer.godaddy.com/keys and sign in with a GoDaddy account.
2. Create a **Production** key/secret pair. Note: GoDaddy currently
   requires the account to have an active domain or prior purchase
   before issuing production keys — if you don't have one yet, create
   an **OTE** (test) key instead, which is free and instant, and set
   `GODADDY_API_ENV=test` (results will be sandbox data, not real).
3. Set:
```
GODADDY_API_KEY=...
GODADDY_API_SECRET=...
```

Leave both unset and `/admin/domain-search` shows a "not configured"
message instead of erroring.

### Content still needed before launch

- **Event details** — fill in `/admin/event-settings` (currently shows
  the seeded "Mahesh J. Shah" defaults from `supabase/seed.sql`).
- **Gallery photos** — add them via `/admin/gallery`. Empty categories
  show a "coming soon" state.
- **Timeline** — add milestones via `/admin/timeline`; the section is
  hidden entirely until at least one exists.
- **Admin account** — see "Admin access" above; nobody can reach
  `/admin` until you create one.
- **Invitees** — either add them one at a time from `/admin/invitees`,
  or bulk-import via CSV.
- **Visibility** — new events default to Private (link-only). If you
  want Mahesh's event listed on the public `/events` directory, flip it
  to Public in Event Settings.

### Known limitations

- Video/audio files upload as-is (not compressed client-side) — only
  photos are compressed before upload. Compressing video in-browser
  would need a much heavier tool (ffmpeg.wasm); out of scope for now.
- The per-guest upload cap (40 files) and moderation queue are the main
  abuse safeguards — there's no CAPTCHA or IP-based rate limiting.
- Deleting an invitee cascades to their RSVP/uploads/activity — there's
  a confirm dialog, but no undo.
- The site currently supports one active event at a time (`EVENT_SLUG`
  in `lib/constants.ts`) for the homepage and admin dashboard. Other
  events are reachable at `/events/[slug]` and can be created directly
  in the `events` table, but there's no admin UI yet to create a new
  event or switch which one the dashboard manages.
- Not yet built (deliberately deferred — see `docs/business-growth-guide.md`
  for the reasoning on each): a developer-facing template marketplace
  with paid listings and real checkout (Stripe/Razorpay), an AI
  prompt-based site redesigner, self-serve customer signup + billing
  (today every new event is onboarded manually), the "build free, pay to
  publish" paywall gate, and custom-domain connection UI (the DNS steps
  exist in the guide, but there's no in-app flow yet). These are on the
  roadmap — see the "Coming Soon" section on `/platform`.
