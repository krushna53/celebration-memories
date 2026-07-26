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
seed data) that the RSVP flow needs.

## Deployment

Deploys to **Netlify** via `@netlify/plugin-nextjs` (see `netlify.toml`).
Set the same three Supabase env vars from `.env.example` in Netlify's
site settings (Site configuration → Environment variables).

## Status

Phase 1 complete: project setup, theme, layout, navigation, hero, footer.

Phase 2 complete: Countdown, Invitation, Event Details, Gallery, Timeline,
and RSVP-teaser sections, all with scroll-in animations.

Phase 3 complete: Supabase schema (events/invitees/rsvps/activity_logs),
unique per-guest invite tokens, the `/invite/[token]` guest-facing page
with automatic guest identification + open/visit tracking, and a full
RSVP form (react-hook-form + zod) wired to a Server Action.

See CLAUDE.md for Phase 4+ (guest photo/video/audio uploads, guestbook,
memory wall, admin dashboard).

### Content still needed before launch

- **Venue** — fill in `lib/constants.ts` → `VENUE` (name, address, Google
  Maps embed/directions URLs, parking, dress code). The Event Details
  section shows "to be announced" placeholders until then.
- **Gallery photos** — add entries to
  `features/gallery/gallery-data.ts` and drop the corresponding images
  under `public/gallery/<category>/`. Empty categories show a "coming
  soon" state.
- **Timeline** — `features/timeline/timeline-data.ts` currently has
  placeholder life-stage milestones; replace with real dates/stories.
- **Supabase project** — provision it and run the migration/seed (see
  `supabase/README.md`), then create real invitee rows with tokens from
  `lib/tokens.ts` (a proper admin UI for this lands in Phase 5).
