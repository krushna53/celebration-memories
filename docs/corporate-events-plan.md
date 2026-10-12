# Corporate events — plan

Goal: serve corporate clients (conferences, offsites, annual days,
launches, team-building — e.g. event agencies like CorpCrew) with the
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
  attendance, uploads, most active attendees), linked from Overview.

Still open (each needs a decision first):
- **QR check-in** — needs a self-hosted QR generator (new npm
  dependency): the existing `lib/qr.ts` sends the encoded URL to a
  third-party service, which is fine for game links but would leak a
  guest's invite token.
- **Company + designation as real columns**, **speakers** and
  **sponsors** sections — need additive migrations on the shared
  production database (apply before deploying the code that reads them).
- Agency branding ("Powered by <agency>") on event footers.
- Multi-track agenda in Event Day.

## Phase 4 — go to market

Done: `/corporate` landing page (in the marketing nav and sitemap),
CTA starts a corporate draft.

Still open: agency pricing (per-event / annual / co-branded) and a
seeded corporate demo event for sales demos.
