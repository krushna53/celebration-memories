# Corporate events — plan

Goal: serve corporate clients (conferences, offsites, annual days,
launches, team-building — and the event organisers and agencies who run
them for others) with the
**same features** the family side already has, without forking pages
or breaking any existing event.

## Principle: one codebase, two "segments"

The first question a host answers is **family or corporate**. That
choice is a *segment* (`lib/event-segment.ts`), derived from the
existing `events.category` — not a new column — so:

- every existing event keeps rendering exactly as before (all current
  categories except `corporate`/`workshop` are "family");
- every feature (RSVP, invite tokens, check-in, uploads, moderation,
  games, Event Day, reels, slideshow, analytics, AI avatar) stays one
  implementation;
- what differs per segment is **copy, defaults and which options are
  offered** — all looked up from registries (`SEGMENT_COPY`,
  `SEGMENT_OCCASIONS`), never `if (corporate)` inside components.

Category-level wording (honoree field label, wish message) keeps living
in `lib/event-category.ts`; segment-level wording lives in
`lib/event-segment.ts`.

## Phase 1 — segment foundation ✅ (this change)

- `lib/event-segment.ts`: segment derivation, occasion tiles per
  segment, segment copy, corporate gallery chapter defaults, and the
  pure `occasionSelectionPatch()` that decides what to save when a
  tile is picked.
- `/start`: "What kind of event is it?" — Family & Personal vs
  Corporate & Professional (plain submit buttons, no JS needed).
  The draft starts with the matching category/title.
- Occasion step: segment toggle + per-segment tiles. Corporate tiles
  (Conference, Offsite, Annual Day, Awards Night, Product Launch, Team
  Building, Workshop, Other) reuse the existing `corporate`/`workshop`
  categories and prefill `events.occasion` — **no enum migration**.
- Gallery: corporate events start with chapter names Arrivals ·
  Keynotes & Sessions · The Team · Venue & Experiences · Networking ·
  Behind the Scenes, seeded into the existing
  `events.gallery_chapter_titles` (so the public gallery, admin
  manager and wizard need no corporate code). Switching back to a
  family occasion removes them if untouched.
- Public sections: Timeline ("Our Journey") and Memory Wall ("Event
  Wall", "Share a Moment") take segment copy.
- Wizard Timeline/Gallery step descriptions are segment-aware.

## Phase 2 — corporate wording everywhere ✅

- Wizard sidebar/step copy resolves with the segment
  (`resolveWizardSteps(goals, category)`; `WizardStepShell` takes
  `category`).
- Guest pages: invite page (invite line, thank-you, share text, uploads
  heading, RSVP reminder), public upload page, hero relive buttons and
  countdown label — all from `SEGMENT_COPY[segment].guest`.
- Admin: nav labels (Invitees → Attendees, Memories → Event Wall,
  Timeline → Our Journey, Guest Reels → Attendee Reels) via
  `navLabelsForSegment()`; Invitees page heading; the free-text
  `relationship` column shows as "Company / Team" (CSV also accepts a
  `company` column).
- WhatsApp: corporate default invite + thank-you templates
  (`defaultMessageTemplates()`), used by Invitees/Bulk Send and the
  Event Settings preview. Family defaults unchanged.
- AI avatar: professional host intro for corporate events.
- AI gallery tagger: corporate category guide (Arrivals, Keynotes, Team,
  Venue, Networking, Behind the Scenes) for admin + wizard uploads.
- Category `<select>`s (wizard + Event Settings) grouped by segment;
  changing category in Event Settings seeds/removes the corporate
  gallery chapter names like the wizard does.

## Phase 3 — corporate additions

Done:
- `/admin/report` — one-page printable event report (opens, RSVP rate,
  attendance, uploads, most active attendees, first opens by day),
  linked from Overview.
- Check-In for agencies: on corporate events a client-role host can run
  the desk (`clientMayCheckIn` — nav, page guard and Server Action gate);
  family events keep owner + organizer only. The desk re-syncs every 15s
  (live attendance across devices) and searches name, phone or company.
- Attendee Reels: corporate reels pair attendees with a "featured
  person" (CEO / keynote speaker) and caption "Priya at <event>";
  wording from `SEGMENT_COPY[segment].reels`.
- Co-branding: "Event powered by <agency>" on the event site and invite
  pages, set from an Event Settings card (`services/event-cobrand.ts`).
  Migration `20261012120000_event_cobranding.sql` applied 2026-10-12.
- Agency branding (`/admin/branding`, `services/host-brands.ts`, table
  `host_brands`, applied 2026-10-12): any host account (a wedding planner,
  an event agency, a corporate events team) sets
  its name, website and logo once; every event it owns
  (`events.owner_user_id`) shows "Event powered by <brand>" with the logo,
  and the dashboard header shows the brand to everyone on that event's
  team. An event's own Co-branding card overrides the name per event.

Still open (each needs a decision first):
- **QR check-in** — needs a self-hosted QR generator (new npm
  dependency): the existing `lib/qr.ts` sends the encoded URL to a
  third-party service, which is fine for game links but would leak a
  guest's invite token.
- **Company + designation as real columns**, **speakers** and
  **sponsors** sections — need additive migrations on the shared
  production database (apply before deploying the code that reads them).
- Multi-track agenda in Event Day.

## Phase 4 — go to market

Done: `/corporate` landing page (in the marketing nav and sitemap) —
lifecycle, agency features, partnership options (per event / agency plan
/ co-branded, "talk to us" until prices are set), the 4-step pilot with
a WhatsApp demo link, and the free vendor-directory listing.

Still open: real agency prices in `lib/event-plans.ts` once decided, and
a seeded corporate demo event for sales demos.
