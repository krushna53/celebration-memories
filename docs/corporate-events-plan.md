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

## Phase 2 — corporate wording everywhere

- Wizard sidebar/step registry descriptions ("Add life milestones",
  "What are you celebrating?") → resolve with the segment.
- Admin: "Guests" → "Attendees", "Memories" → "Event Wall" etc. via a
  segment label map used by `lib/admin-nav.ts` and page headings.
- Guest-facing invite page, RSVP form, uploads page, WhatsApp invite
  default template, AI avatar system prompt: segment copy.
- Event Settings category `<select>`: group options by segment and
  apply `occasionSelectionPatch` when the category changes there too.
- AI gallery tagger: corporate category descriptions so auto-sorting
  maps to Keynotes / Team / Networking instead of Childhood / Wedding.
- Recommend Corporate Slate / Live Signal first for corporate drafts.

## Phase 3 — corporate-only additions (reusing existing pieces)

- Attendee fields: company + designation on invitees/RSVP (CSV import
  columns, RSVP form, check-in search).
- Agenda: Event Day schedule promoted to a homepage section for
  corporate (multi-track sessions later), speakers block reusing the
  timeline milestone model (photo, name, title).
- Sponsors / partner logos section (gallery-style grid).
- QR code per invite token for desk check-in (lib/qr.ts exists).
- Client report: one-page export of the analytics dashboard (opens,
  RSVP rate, attendance, uploads, most active) for the agency to send.
- Agency accounts: one owner managing many client events already works
  via `admin_event_memberships`; add agency branding ("Powered by
  <agency>") on event footers.

## Phase 4 — go to market

- `/corporate` landing page + pricing for agencies (per-event /
  annual / co-branded).
- Corporate demo event seeded for sales demos.
