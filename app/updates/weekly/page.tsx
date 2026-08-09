import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekly Update",
  // Deliberately unlisted, not indexed — no nav/footer link points here
  // on purpose (see this file's own doc comment below). This is an
  // internal changelog reachable only by direct URL.
  robots: { index: false, follow: false },
};

interface ChangeItem {
  title: string;
  detail: string;
  test: string;
}

interface ChangeGroup {
  date: string;
  items: ChangeItem[];
}

/**
 * Internal, unlisted weekly changelog — reachable only at
 * /updates/weekly, never linked from any nav/footer (see
 * components/layout/footer.tsx, features/platform/platform-marketing-
 * content.tsx's PLATFORM_NAV_LINKS — neither references this route).
 * Not gated behind admin auth either: it's a plain, noindex'd page
 * meant to be shared as a direct link for a quick "here's what changed
 * this week" read and mobile test pass, not a permanent site section.
 *
 * Content below is a manually-curated summary of this week's commits
 * (see `git log` for the authoritative list) — update by hand each
 * week rather than generating from commit messages automatically,
 * since a commit message and "what a non-technical reader needs to
 * know to go test this" are different things.
 */
const CHANGES: ChangeGroup[] = [
  {
    date: "Sunday, August 9 (newest)",
    items: [
      {
        title: "Live preview now shows up in the /start wizard too, no account needed",
        detail:
          "The live preview panel (Countdown, Invitation, Event Details, Gallery, Timeline, RSVP, Wish Message, Memory Wall) was previously admin-only, inside Event Settings — a host filling out the free /start wizard before creating any account couldn't see it at all. It now also appears at the top of the wizard's \"Event Details\" step, open by default and staying in view while you scroll, updating live as you type — same component, same instant feedback, no login required.",
        test:
          "Open a /start/[token]/basics link (or start a fresh draft at /start) without being logged in — a \"Live Preview\" panel should already be open near the top of the page. Type into Honoree Name, Tagline, or Wish Message and watch it update immediately.",
      },
    ],
  },
  {
    date: "Sunday, August 9 (latest)",
    items: [
      {
        title: "Live preview panel in Event Settings",
        detail:
          "Event Settings now shows a live preview as you type — honoree name, tagline, host, date, venue, and every homepage section (Countdown, Invitation, Event Details, Gallery, Timeline, RSVP, Wish Message, Memory Wall) update instantly, no saving required. Reordering or hiding/showing a section in \"Homepage Sections\" reflects in the preview the same instant, before you even tap Save Section Order. On desktop the preview is sticky on the right, staying in view as you scroll through every step of the form; on mobile it's a sticky collapsible \"Live Preview\" panel that stays reachable near the top of the screen throughout. It's a lightweight brand-shell preview (navy/gold/ivory), not a pixel-perfect render of your event's active visual template — that's still best checked on the live page itself.",
        test:
          "Open Admin → Event Settings on a wide screen — a preview card should appear on the right showing every section, not just Hero. Change the Honoree Name or Wish Message and watch it update immediately. Scroll to \"Homepage Sections\" and hide Countdown or Memory Wall (tap the eye icon) — it should disappear from the preview right away, without saving. On your phone, tap \"Live Preview\" near the top — it should stay visible as you scroll further down the page.",
      },
    ],
  },
  {
    date: "Sunday, August 9 (even later)",
    items: [
      {
        title: "Third push type: countdown + \"new content\" notifications",
        detail:
          "A new \"Stay in the loop?\" prompt on the personal invite page offers general event-update notifications — countdown milestones (7 days to go, 1 day to go, today's the day) and \"new photos/memories added\" alerts, at most once a day. Deliberately not a Zomato/Zepto-style multiple-times-a-day blast — a wedding or birthday isn't a habit-forming app, and that cadence would likely get guests to just turn notifications off. Also fixed: every notification prompt in the app now correctly detects that iPhone Safari only allows push notifications once the site's been added to the Home Screen (an Apple restriction) — Android/Chrome/desktop guests can opt in immediately in a normal browser tab.",
        test:
          "On your phone, open a personal invite link — after a couple seconds you should see a \"Stay in the loop?\" prompt near the bottom (on iPhone, only after adding the site to your Home Screen first). To test delivery immediately: Admin → Event Settings → \"Guest Reminders\" → \"Event Updates\" → \"Send now\".",
      },
    ],
  },
  {
    date: "Sunday, August 9 (later)",
    items: [
      {
        title: "Admin notification center — bell icon in the dashboard",
        detail:
          "A new bell icon in the admin header (both the full dashboard and the Simple View) shows a shared inbox covering four things: an alert the moment a guest RSVPs (in-app + email, sent to you and the site owner), a daily nudge about one feature you haven't tried yet (Gallery, Planner, Video Editor, Guest List, AI Image, AI Avatar — stops once you've used it), a warning once your event's storage usage crosses 80% of its quota (editable in Event Settings → Storage), and — once your event has passed — an occasional \"planning another event?\" prompt. No setup needed for any of this.",
        test:
          "Look for the bell icon next to Sign Out in the admin header — tap it to see the panel. To see an RSVP alert specifically: open your event's public/personal RSVP page in another tab and submit one — a notification (and email, if RESEND_API_KEY is configured) should appear within a few seconds. Event Settings → \"Storage\" shows your current usage against an editable quota.",
      },
      {
        title: "Guest reminder push notifications",
        detail:
          "If a guest starts recording or picking a video/audio message on their personal invite link but never finishes uploading it, they can now opt in to a real notification on their phone — a small \"Remind me\" prompt appears right on the upload screen once they have something unfinished. The reminder arrives even if they've closed the site or app entirely (a true push notification, not just an in-app banner), and only fires once per unfinished attempt. Off by default until Web Push is configured (see supabase/README.md) — until then this section simply doesn't appear, nothing breaks.",
        test:
          "On your phone, open a personal invite link (/invite/[token]), tap \"Record Video\", record a few seconds, tap \"Done — Review & Upload\", then back out WITHOUT tapping Upload — you should see a gold \"Want a reminder?\" prompt. Tap \"Remind me\" and allow notifications when your browser asks. To actually test delivery without waiting the full delay: go to Admin → Event Settings → \"Guest Reminders\" and tap \"Send reminders now\" — a notification should land on your phone within a few seconds.",
      },
      {
        title: "Second push type: \"share a memory\" nudge for RSVP'd guests",
        detail:
          "A separate one-time reminder for guests who RSVP'd \"coming\" or \"maybe\" but haven't shared a photo/video/message yet — sent once, a few days before the event. Guests opt in right after submitting their RSVP, not on the upload screen, so guests who never touch the upload flow still get asked.",
        test:
          "On your phone, open a personal invite link, submit an RSVP as \"Joyfully Accepts\" or the maybe option — you should see a \"Get a reminder to share a memory?\" prompt right after submitting. Tap \"Notify me\" and allow notifications. To test delivery immediately: Admin → Event Settings → \"Guest Reminders\" → \"Send memory-nudge now\".",
      },
    ],
  },
  {
    date: "Friday, August 7",
    items: [
      {
        title: "AI Image invitation cards now show real text",
        detail:
          "The AI Image tool used to explicitly tell the AI not to render any text, so invitation cards came back as pure decoration with no name/date on them. Fixed — it now asks for the honoree's name, occasion, date, and host line to be rendered clearly on the card.",
        test: "Go to Admin → AI Image (or the /start wizard's Invitation Card step), generate a new image, and confirm the event's name/date/host actually appear on it, legibly.",
      },
      {
        title: "Wizard: \"What to Build\" pre-fills based on your Occasion",
        detail:
          "After picking an occasion (birthday, wedding, corporate, etc.) in the /start wizard, the next step now pre-selects a sensible default (e.g. a wedding defaults to Website + Slideshow + Invitation Card; a workshop defaults to just Website) instead of starting blank. Still fully editable with one tap.",
        test: "Start a new draft at /start, pick any occasion, and check that the next step already has some options highlighted instead of none.",
      },
      {
        title: "4 new page templates",
        detail:
          "Eternal Rest and Candlelight Tribute (two new memorial/obituary looks) and Boardroom Ivory and Momentum (two new corporate/workshop looks) — on top of the existing ones.",
        test: "Admin → Templates (or the wizard's Template step) — scroll the gallery and look for the 4 new names/thumbnails.",
      },
    ],
  },
  {
    date: "Tuesday, August 5",
    items: [
      {
        title: "Guests must give a real name for every upload, not just video",
        detail:
          "On the public \"share a memory\" page (no login needed), a guest could tap Photo/Note/Audio without typing their name and get saved permanently as literally \"Guest\" — with no way to fix it later. Now a name is required before any upload type, same as video already required.",
        test: "Open an event's public memories link (/events/[slug]/memories) in a private/incognito tab, try tapping any upload button without typing a name first — it should now block you and ask for a name.",
      },
      {
        title: "Admins with no event linked yet get sent somewhere useful",
        detail:
          "Previously, an admin account not yet linked to an event hit a dead-end page with no header and no way out. Now they're sent into the /start wizard, which recognizes they're already signed in and offers to link the new event to their existing account instead of trying to create a duplicate one.",
        test: "Not easily testable without an unlinked test account — safe to skip unless you have one handy.",
      },
    ],
  },
  {
    date: "Monday, August 4",
    items: [
      {
        title: "Installable mobile app (PWA + native wrapper)",
        detail:
          "The site can now be installed like a real app — \"Install app\" on Android/Chrome, \"Add to Home Screen\" on iPhone/Safari — launching full-screen with no browser bar. A dismissible banner now prompts guests to do this on every public page. The underlying native iOS/Android project (Capacitor) was also added for an eventual App Store/Play Store release.",
        test: "See \"Mobile testing steps\" below — this is the main thing worth testing on your actual phone.",
      },
      {
        title: "Flip camera fixed when recording video",
        detail:
          "Switching between front/back camera while recording a video message used to silently fail on iPhone (and some Android phones) because it tried to open the new camera before releasing the old one — most phones only allow one camera stream at a time. Fixed to release-then-reopen.",
        test: "On your phone, open any event's memory upload page, tap \"Record Video\", then tap the flip-camera icon — it should now actually switch cameras instead of doing nothing or erroring.",
      },
      {
        title: "Video Editor: Help & FAQ, transitions, aspect ratio picker",
        detail:
          "Added a collapsible FAQ block explaining how to use every Video Editor feature, plus clip transitions and an aspect ratio picker.",
        test: "Admin → Video Editor — scroll below the canvas for the new FAQ; try a transition and the aspect ratio dropdown on a clip.",
      },
    ],
  },
];

export default function WeeklyUpdatePage() {
  return (
    <div className="min-h-screen bg-ivory-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-gold-700">Internal — not linked anywhere on the site</p>
        <h1 className="mt-2 font-display text-3xl text-navy-950 sm:text-4xl">Weekly Update</h1>
        <p className="mt-1 text-sm text-navy-700/60">Sunday, August 9, 2026</p>

        <div className="mt-10 grid gap-10">
          {CHANGES.map((group) => (
            <section key={group.date}>
              <h2 className="font-display text-lg text-navy-950">{group.date}</h2>
              <div className="mt-4 grid gap-5">
                {group.items.map((item) => (
                  <div key={item.title} className="rounded-xl border border-navy-950/10 bg-white p-5">
                    <h3 className="font-medium text-navy-950">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-navy-700/70">{item.detail}</p>
                    <p className="mt-3 text-xs leading-relaxed text-gold-700">
                      <span className="font-semibold uppercase tracking-wide">How to check: </span>
                      {item.test}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-12 rounded-xl border border-gold-500/25 bg-gold-500/5 p-6">
          <h2 className="font-display text-lg text-navy-950">How to test all of this on your phone</h2>
          <ol className="mt-3 grid list-decimal gap-2.5 pl-5 text-sm leading-relaxed text-navy-700/80">
            <li>Open your live site URL in your phone&rsquo;s browser (Chrome on Android, Safari on iPhone).</li>
            <li>
              You should see a banner near the bottom of the screen offering to install the app — on Android it has an
              &ldquo;Install&rdquo; button; on iPhone it explains Share → Add to Home Screen. Try installing it — it
              should open full-screen, no browser address bar, like a real app.
            </li>
            <li>
              From your home screen icon (or still in the browser), open any event and go through the items above
              one at a time — most only take a minute each.
            </li>
            <li>
              For the video/camera items specifically, testing on your actual phone matters more than a laptop — the
              camera-switch bug only ever showed up on real phone hardware, not a desktop browser.
            </li>
          </ol>
        </section>
      </div>
    </div>
  );
}
