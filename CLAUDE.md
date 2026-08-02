# CLAUDE.md — Celebration Memories (as-built)

This file documents what's actually **built and working** in this
codebase today, as a quick-orientation reference for future Claude
sessions (or a developer) picking this project back up. It's a
companion to two other docs, not a replacement for either:

- **`/CLAUDE.md`** (one directory up, in the project root) is the
  original product spec and phased delivery plan this build started
  from — birthdays only, a fixed 6-phase roadmap. Useful for the
  original intent; badly out of date on scope (the platform has grown
  far beyond it — multi-event, multi-role admin, a business/vendor
  marketplace, games, AI features, a full self-serve wizard, and more).
- **`README.md`** (this directory) is the detailed, user-facing status
  doc — setup instructions, deployment, and long prose write-ups of
  most admin features with exact config steps (env vars, API key
  signup, SQL snippets). It's the right place to look for **how to
  configure or operate** a feature. This file is the right place to
  look for **what exists and how the code is organized**, including a
  few feature areas README.md doesn't cover yet (Games, the Business/
  Marketplace directory, Planner) and everything added most recently
  (Event Day, AI Avatar, per-event timezones, the mobile upload/
  recording rework).

If the two ever disagree on a specific config step, trust README.md —
it's the more actively maintained operational doc. If they disagree on
what's actually implemented, trust the codebase itself over either.

---

## Stack

Next.js 15 (App Router) · TypeScript (strict, `noUncheckedIndexedAccess`
on) · Tailwind CSS v4 · Supabase (Postgres + Storage + Auth + Edge
Functions) · Framer Motion · GSAP. Deploys to **Netlify**
(`@netlify/plugin-nextjs`, see `netlify.toml`) — not Vercel.

## Repo layout

Feature-based, not type-based, per the original CLAUDE.md's
architecture mandate:

```
app/            Next.js routes (App Router) — thin, mostly compose features/
features/       One folder per feature area — components + actions.ts (Server Actions)
services/       Server-only data-access layer (supabaseAdmin, business logic)
lib/            Framework-agnostic helpers, config-driven registries, third-party clients
types/          Shared TypeScript types
components/     Generic/shared UI (not feature-specific) — layout, ui primitives, motion
hooks/          Shared client-side hooks
supabase/       Migrations, seed data, Edge Functions
templates/      The 5 visual event templates (see "Templates" below)
docs/           risk-analysis.md, business-growth-guide.md — planning docs, not user-facing
```

## Core conventions

These patterns are used consistently everywhere — worth knowing before
touching any feature:

- **Server Actions return a result object, never throw to the caller.**
  Shape is either `{ success: true; data: T }` / `{ success: true }` or
  `{ success: false; error: string }`. Every actions.ts file follows
  this; UI code always checks `.success` before touching `.data`.
- **`supabaseAdmin()`** (`lib/supabase/admin.ts`) is the service-role
  client used for essentially all server-side reads/writes — RLS is
  enabled on tables but with no public policies, so authorization is
  enforced in application code (Server Actions/services), not
  database-level policies.
- **"Possession of a token is the credential."** Guests never log in.
  A guest's invite token (`/invite/[token]`), a draft's
  `draft_token` (`/start/[token]`), a game's share token
  (`/games/[token]`), an Event Day private share token, and a business
  account's own session are all bearer-token trust models — every
  Server Action that takes one **re-resolves** the underlying
  record from the token server-side rather than trusting any id the
  client hands back. This shows up as a repeated pattern: `const found
  = await getXByToken(token); if (!found) return { success: false,
  ... }`.
- **Admin auth is Supabase Auth + an `admins` allowlist table**, not
  Supabase Auth alone — being signed in isn't suffient, the account
  needs a row in `admins`. Every `admins` row has a `role` of `owner`
  or `client`; enforcement is three layers (nav visibility, a redirect
  guard per restricted page, and a `requireOwner()`/
  `requireAdminForEvent()` check inside every owner-only or event-
  scoped Server Action) so a client-role admin can't reach another
  event's data even by guessing a URL. See `lib/admin-roles.ts`
  (`CLIENT_ALLOWED_PATHS`) and `lib/admin-event.ts`
  (`resolveAdminEvent()`, `requireAdminForEvent()`).
- **Which event an admin page shows** is never hardcoded — it resolves
  through `resolveAdminEvent()`: a client admin always sees their own
  `admins.event_id`; the owner sees whichever event they last picked
  from `/admin/events` (a cookie, `lib/admin-active-event.ts`), falling
  back to the flagship `EVENT_SLUG` event (`lib/constants.ts`) with
  nothing selected.
- **Uploads go straight from the guest's browser to Supabase Storage**
  via a short-lived signed URL — never through a Next.js Server
  Action/route as a file body (keeps requests small on mobile data and
  avoids Netlify payload limits). Two-step pattern everywhere:
  `requestUploadUrl`/`createSigned*Upload` (server mints the signed
  URL) → browser PUTs the file directly to Storage → `confirmUpload`/
  `confirmMediaUpload` (server records the DB row). MIME-type
  validation happens **twice** — once in application code
  (`types/memory.ts`'s `ACCEPTED_MIME_TYPES`) and once at the Storage
  bucket level (`allowed_mime_types`, set via migration) — both must
  agree or an upload that passes one check still gets rejected by the
  other.
- **Long-running/expensive work runs in a Supabase Edge Function, not
  a Next.js Server Action or Netlify Function.** OpenAI image
  generation and Shotstack slideshow rendering both routinely exceed
  Netlify's synchronous function time limit; Supabase Edge Functions
  get a much longer wall-clock budget. AI Image is a single synchronous
  Edge Function call; Slideshow Video (Shotstack renders are genuinely
  async) uses a submit-then-poll pair of Edge Functions instead. A
  Netlify Background Function was tried first for AI Image and
  abandoned after a hard-to-diagnose platform-level failure — see
  README.md's collapsed "Why not a Netlify Background Function?"
  section for the full postmortem before reaching for that pattern
  again.
- **Config-driven registries, not hardcoded switches.** Templates
  (`lib/template-catalog.ts` + `lib/templates.ts`), event categories
  (`lib/event-category.ts`), and the homepage section order
  (`events.section_config`, `lib/section-registry.ts`) all work this
  way — adding a new template/category/section is additive (one new
  registry entry), never an if/else added to existing code.
- **Optional paid integrations degrade gracefully.** AI Image, AI CSS,
  Slideshow Video, Domain Search, Resend email, and the AI Avatar all
  check for their API key/config at call time and show a "not
  configured" message instead of erroring when it's unset — the rest
  of the site is unaffected either way. Client-role admins are quota-
  capped per event on every AI feature (`events.ai_image_generation_limit`,
  `ai_css_generation_limit`, `slideshow_video_generation_limit`,
  `ai_avatar_daily_message_limit`); the owner is exempt from all of them.

## Feature inventory

### Public event site

Hero → Countdown → Invitation → Event Details → Gallery → Timeline →
RSVP → Wish Message → Memory Wall, per-event and reorderable/hideable
independently (`features/event-landing/`, backed by
`events.section_config`). Available at `/` (the flagship
`EVENT_SLUG` event) and `/events/[slug]` (any event, public or
private — visibility only controls whether it's listed on the public
`/events` directory). 5 visual templates (Royal Gold, Floral Pastel,
Minimal White, Kids Cartoon, Neon Party) share the exact same section
stack and only swap CSS custom properties + a named animation
personality — see `templates/`.

### Guest experience

- **RSVP** — personal `/invite/[token]` link with automatic
  identification + visit tracking, or (if enabled per event) public
  self-service `/events/[slug]/rsvp` matched by phone number.
- **Guest uploads** — photos/videos/audio + a Guest Book, reachable
  from a personal invite link (`app/invite/[token]/page.tsx`) or the
  public no-token `/events/[slug]/memories` page
  (`PublicMemoryUploader`, name-only identification). See "Mobile
  upload/recording rework" below for the current UI in detail — this
  changed substantially in the most recent work on this project.
  Everything lands in an admin moderation queue (`approved = false`)
  before it can appear on the public Memory Wall.
- **Event Day** (`/event-day/[token]`, added this round) — a guest-
  facing page showing the time-blocked event schedule (e.g. "11am–12pm
  Cake Cutting, 12–1pm Lunch...") and the menu (buffet or à la carte,
  with dietary tags). Two visibility modes set per event
  (`events.event_day_mode`): `public` (open like the Timeline, no
  gate) or `private` (phone-verified against the invitee list, same
  normalize-and-match pattern as public RSVP). See
  `features/event-day/`, `features/admin/event-day/`,
  `services/event-day.ts`.
- **AI Avatar** (added this round) — an optional chat widget on the
  event homepage (`features/event-avatar/`) that acts as a host/
  greeter and nudges guests toward playing games, RSVPing, or
  uploading a memory. Backed by OpenAI's Responses API
  (`lib/ai-avatar-chat.ts`), rate-limited per event per day
  (`events.ai_avatar_daily_message_limit`, `ai_avatar_messages`
  table — a daily counter, not the all-time caps AI Image/CSS use,
  since this is guest-facing/unbounded traffic). Speaks its replies
  via OpenAI TTS (`lib/ai-avatar-voice.ts`, base64 audio, no Storage)
  and accepts spoken input via the Web Speech API
  (`SpeechRecognition`, feature-detected). Toggled on/off with the
  daily limit in Event Settings.
- **Games** (`/games/[token]`) — Housie/Tambola and Word Search games
  for events, token-gated the same way as everything else guest-
  facing. Ticket-based play, a "call state" (drawn numbers so far),
  attempt tracking, and prize claiming. See `features/games/`,
  `services/games.ts`, `lib/housie.ts`/`lib/word-search.ts` for the
  game logic itself.

### Admin dashboard (`/admin`)

Overview + analytics (RSVP breakdown, upload counts, most active
guests, a self-hosted Visitor Funnel), Event Settings (everything
about the event — see below), Invitees (CRUD, CSV import, WhatsApp
bulk-send queue), Memories (approve/feature/delete + bulk media
export), Check-In, Gallery, Timeline, Templates, and every optional AI/
integration feature listed in README.md (AI Image, AI CSS, Slideshow
Video, Domain Search, referrals, Contact Us inbox, Share Image
composer). Owner vs. client role visibility enforced per the "Core
conventions" section above. A spotlight feature tour
(`lib/admin-tour-steps.ts`) auto-plays once per admin.

**Event Settings** (`features/admin/event-settings/`) is the single
biggest admin surface — honoree/host/tagline, date & time (now
timezone-aware, see below), venue + maps, dress code, visibility,
WhatsApp invite message template, public RSVP/memories toggles, AI
Avatar on/off + daily limit, section order/visibility drag list, and
Custom CSS (with an AI-assisted "Generate with AI" helper, blocklist-
validated before saving either way).

### Timezone (added this round)

Every event now has its own IANA timezone (`events.timezone`, default
`Asia/Kolkata`) instead of the app assuming India Standard Time
everywhere, which used to make an event entered as "11:00 AM" render
as some other time depending on where the page happened to be viewed/
built. Event Settings has a "Detect" button that geocodes the venue
address (`lib/timezone-lookup.ts` — free OpenStreetMap Nominatim +
the `tz-lookup` npm package, deliberately avoiding Google's paid Maps/
Geocoding/TimeZone APIs since there's no Google API key anywhere in
this project) plus a manual override `<select>`
(`lib/timezone.ts`'s `listSupportedTimezones()`, backed by
`Intl.supportedValuesOf`). Every date/time shown anywhere — homepage,
invite page, RSVP page, countdown, Event Day, the big-screen
slideshow — now threads the event's actual timezone through
`formatEventDate`/`formatEventTime` (`lib/timezone.ts`, DST-safe via
an `Intl.DateTimeFormat` round-trip technique rather than adding
`date-fns-tz`). Pure calendar dates (like `occasion_date`, no time-of-
day) deliberately use a separate UTC-anchored `formatCalendarDate` —
never run through the instant-aware formatters, or the displayed day
could shift for negative-UTC-offset zones.

### Mobile upload/recording rework (added this round)

The in-browser video/audio recorder (`features/uploads/components/
video-upload.tsx`, `audio-upload.tsx`, shared queue UI in
`upload-queue.tsx`) went through a significant mobile-usability pass:

- **Fullscreen camera/mic view** (`fixed inset-0`, like a native camera
  app) instead of a small boxed-in preview, with Pause/Cancel/Stop in
  a control bar **below** the video (never overlaid on top of it). A
  live camera preview opens as soon as the guest lands on the record
  view (`useMediaRecorder`'s `openPreview()`/`closePreview()`,
  `hooks/use-media-recorder.ts`), with a pulsing "Turning on your
  camera..." state while the browser negotiates permission/hardware.
- **After a take, "Done — Review & Upload" is the primary button**
  (big gold pill) with "Record Again" as a clear secondary action —
  this used to be reversed (small text link buried under a still-
  prominent "Start Recording" button), which usability testing showed
  guests missing entirely.
- **Closing the recorder mid-recording finalizes instead of
  discarding** — tapping the close (X) button while still recording
  now calls `stop()` not `cancel()`, so a guest who taps the wrong
  button never silently loses a take.
- **A back-button guard** (`MediaUploadsSection`, history-decoy +
  `popstate` trick, plus `beforeunload`) intercepts the phone's back
  button/gesture while there's an unsaved recording (in progress, or
  captured but not yet uploaded) and shows a dialog — Upload Now, Keep
  Editing/Keep Recording, or Leave without saving — instead of
  silently navigating away and losing it.
- **Every queue item has a live local preview** (thumbnail for photos,
  a full-width native player for video/audio, built from the picked/
  recorded `File` via `URL.createObjectURL` — works instantly, before
  the network upload even finishes) plus, once uploaded, a proper
  Delete (with confirm) and a one-tap "Delete & record again."
  Deleting an uploaded item calls a real server action
  (`deleteUploadAction` → `deleteOwnMediaUpload` in
  `services/uploads.ts`) that removes both the Storage object and the
  DB row, ownership-checked against the guest's own invitee id — not
  just a local list removal.
- **Photos get a direct "Take a Photo" camera-capture button** (a
  second file input with `capture="environment"`) next to "Choose from
  Gallery" — no need for the full custom recorder UI for a single
  still shot.
- **webm recording support** — `MediaRecorder` can only produce WebM on
  every non-Safari browser (MP4 is Safari-only); this was silently
  broken for the feature's entire life until fixed by adding
  `video/webm` to `ACCEPTED_MIME_TYPES`, stripping codec-suffixed MIME
  types (`video/webm;codecs=vp8,opus` → `video/webm`) at both the
  recording source and server validation, and updating the Storage
  bucket's own `allowed_mime_types`.

### Business / Marketplace directory

A second, largely independent product living in the same codebase: a
vendor directory (photographers, caterers, etc.) alongside the event-
invitation side. Vendors self-serve sign up/log in
(`/business/signup`, `/business/login`, `features/business/`), build a
listing (profile, gallery photos, services, FAQs, images —
`create-listing-form.tsx`/`listing-profile-form.tsx`), and submit it
for review before it appears publicly. Public-facing, SEO-structured
browsing at `/(category)/(city)/(subcategory)` and a `/discover`
directory (`features/discover/`, `services/marketplace-categories.ts`,
`services/marketplace-listings.ts`), individual listing pages at
`/listing/[slug]`. Has its own admin surfaces under
`/admin/marketplace` and `/admin/template-submissions`. `/roles`
(`app/roles/page.tsx`) is a persona-picker landing page pointing
different visitors (host vs. guest vs. vendor) toward the right start.

### Planner

A lightweight Trello-style task board (`features/planner/planner-board.tsx`,
`types/planner.ts`) — `PlannerTask` (todo/in_progress/done) and sticky-
note-style `PlannerNote`s, presumably for per-event planning checklists.
Newer, less thoroughly explored area than the rest of this doc — check
`services/event-planner.ts` and `app/admin/(dashboard)/planner` before
assuming behavior.

### Self-serve onboarding wizard (`/start`)

A new host can build an event with no account at all — a draft
`events` row authorized by a long random `draft_token` (same trust
model as a guest invite link). Occasion + Goals steps decide which
later steps appear at all; picking only Invitation Card/Slideshow (no
Website) skips account creation entirely. Picking Website leads to
account creation and a payment step
(`features/pricing/`, `lib/stripe.ts`, `lib/razorpay.ts`, promo codes
via `/admin/promo-codes` that bypass payment). See README.md's "Self-
Serve Onboarding Wizard" section for the full step-by-step.

### Payments

Two payment providers wired up (owner picks which one is active in
`/admin/billing`): Stripe and Razorpay (`lib/stripe.ts`,
`lib/razorpay.ts`), used by the onboarding wizard's payment step and
(per `lib/ccavenue.ts` existing too) possibly a third path — check
`services/payments.ts`/`services/wizard-payments.ts` before assuming
which is live in a given environment.

## Known gotchas worth knowing before diving in

- **Sandbox git lock files.** In this particular working environment,
  `.git/index.lock`/`.git/HEAD.lock`/`.git/refs/heads/main.lock`
  intermittently can't be removed with a plain `rm` (FUSE mount quirk,
  "Operation not permitted"). Workaround used throughout this session:
  stage with a separate `GIT_INDEX_FILE`, then `git write-tree` +
  `git commit-tree` + overwrite `.git/refs/heads/main` directly via
  Python, rather than `git add`/`git commit`. A harmless empty
  `testfile456` file in the repo root couldn't be deleted for the same
  reason and is excluded from every commit via pathspec
  (`':!testfile456'`).
- **Every date/time display must take the event's timezone.** If you
  add a new place that shows a date or time, use `formatEventDate`/
  `formatEventTime` from `lib/timezone.ts` with `event.timezone` — not
  `date-fns`'s bare `format()`, which renders in the server's local
  zone (UTC on Netlify), and not a hardcoded IST assumption.
- **MIME-type acceptance lists exist in two places for uploads**
  (`types/memory.ts` and the Storage bucket's own
  `allowed_mime_types`) — changing one without the other means uploads
  that pass application validation still get rejected by Storage, or
  vice versa.
- **Never trust a client-supplied id in a token-gated Server Action.**
  Always re-resolve from the token first (`getInviteeByToken`,
  `getEventByEventDayToken`, `getGameByShareToken`, etc.) — this is the
  load-bearing security property of the whole "no login for guests"
  model.

## Known pending / paused work

- **Workshop QR: check-in + session attendance** — scoped as part of
  a broader "AI QR Experience Engine" concept but never started; no
  strong preference was given on priority.
- **10+ new event templates across occasions** (weddings, retirement,
  baby showers, etc.) — explicitly paused, not resumed.
- **AI Avatar credits/billing system** — a per-client credit/payment
  system for AI Avatar usage was explored and explicitly declined
  ("keep it as is right now") — it's capped by the daily message limit
  only, no billing layer.
- **Custom domain auto-routing** — see README.md's "Custom Domains"
  section; today this is manual per-client Netlify config, not
  `Host`-header-based routing.
- **Marketplace/Planner/Games documentation** — these three areas are
  functional in the codebase but far less documented in prose (here or
  in README.md) than the core event/admin experience; read the actual
  `services/*.ts` and `types/*.ts` files for these before making
  assumptions about exact behavior.
