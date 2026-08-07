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
        <p className="mt-1 text-sm text-navy-700/60">Friday, August 7, 2026</p>

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
