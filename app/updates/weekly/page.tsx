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
    date: "Monday, August 10 (night)",
    items: [
      {
        title: "Client self-serve account deletion (task #71)",
        detail:
          "New \"Delete Account\" page in the admin sidebar (client hosts only). Two steps: send a 6-digit code to the account's own email, then enter it plus type \"DELETE\" to confirm. On confirmation, everything is permanently removed — the login, the event, every invitee/RSVP, all gallery/timeline/guest-uploaded photos and videos (including the actual files in storage, not just the database rows), backups, the works. Reuses the same cascade-delete the owner's existing account-management tool already had, just gated behind an emailed code instead of an owner typing someone else's email. Refuses to run if any other team member or session organizer still has their own login on the event — remove them first.",
        test:
          "As a client admin, open \"Delete Account,\" click \"Send Me a Verification Code,\" and confirm an email arrives with a 6-digit code. Enter it plus \"DELETE\" and confirm the browser warning — the event and all its data should be gone, and you should be signed out and redirected home. Also confirm it refuses to proceed if a team member or session organizer is still attached to the event.",
      },
    ],
  },
  {
    date: "Monday, August 10 (late evening)",
    items: [
      {
        title: "Backups — automatic version history for Event Settings, Gallery, Timeline, and Invitees (task #70)",
        detail:
          "New \"Backups\" page in the admin sidebar. Every time you save Event Settings (including switching Templates or editing Custom CSS), or add/edit/delete something in Gallery, Timeline, or Invitees, a snapshot of what things looked like right before is saved automatically — no button to remember to press. Backups shows a tab per area with a list of recent versions (when, and who made the change) and a Restore button. Restoring itself takes a snapshot first, so you can always undo an undo. A couple of area-specific safety notes: Gallery and Timeline restores are a full revert to that point in time (anything added after the backup, including its file, is removed), while Invitees restores are gentler by design — they undo edits or bring back deleted guests, but never remove a guest added after the backup, so an invite link you already sent out never breaks. Both the event's client host and the site owner can see history and restore.",
        test:
          "Edit something in Event Settings, save, then edit it again with a different value and save. Open Admin → Backups, switch to the \"Event Settings & Template\" tab, and confirm you see two versions with timestamps. Restore the older one and confirm the field goes back to its first value. Repeat quickly for Gallery (upload a photo, delete it, restore the backup from before the delete, confirm the photo reappears) and Invitees (add a guest, then check that restoring an older backup does NOT remove that guest).",
      },
    ],
  },
  {
    date: "Monday, August 10 (evening)",
    items: [
      {
        title: "Per-session registration, payment, and Session Organizers (task #63)",
        detail:
          "For workshop-style events with multiple sessions: each Event Day session (Admin → Event Day) can now require registration and optionally be paid, with its own Regular Price and Early-Bird Price + deadline, independent of the event's own RSVP price. A session can also have its own payment method override (bank/UPI or gateway keys, owner-reviewed same as before) instead of using the event's default. Guests register/pay per-session from their personal, phone-verified /event-day link — the anonymous public homepage schedule stays read-only, since there's no guest identity to attach a registration to there. New \"Session Organizers\" role: a client can give someone a narrow, view-only login scoped to one or more specific sessions (Admin → Session Organizers to manage them; they land on Admin → My Sessions, seeing only their own session's attendee list and payments, nothing else about the event). Everyone relevant — client, owner, and that session's organizer(s) — gets notified when a registration or payment comes in.",
        test:
          "In Admin → Event Day, open a schedule item's \"Registration & Pricing,\" turn on registration (and optionally paid + prices), save. Visit that event's private Event Day link, verify your phone, and confirm a Register/Register & Pay button appears on that session — test both a free registration and a paid one (manual reference-number path is easiest). In Admin → Session Organizers, add someone scoped to that session (either invite method); sign in as them and confirm they land on My Sessions showing only that session's attendees/payments, and that every other nav link is gone and direct URLs to other admin pages redirect them away.",
      },
    ],
  },
  {
    date: "Monday, August 10 (later)",
    items: [
      {
        title: "Paid RSVP — guests can pay to confirm registration (task #62)",
        detail:
          "Event Settings has a new \"Paid Registration\" section — turn on \"require payment,\" set a Regular Price, and optionally an Early-Bird Price with a deadline. Once on, RSVPing \"coming\" (personal invite link or the public no-token RSVP page) leads into a payment step charged through the event's own approved payment method (from \"My Payment Method,\" the previous update) — Stripe/Razorpay/CCAvenue redirect to a secure checkout and confirm automatically on return; Bank/UPI shows the details and a \"submit for confirmation\" box for a reference number, which then needs a quick approval on the new \"RSVP Payments\" admin page. Everyone tied to the event (client host + owner) gets notified the moment a payment comes in or a manual one needs review.",
        test:
          "In Event Settings, turn on Paid Registration, set a Regular Price (and optionally an Early-Bird Price + deadline), and save. RSVP \"coming\" on that event's invite link or public RSVP page — a payment step should appear with the right price. If the event's payment method is Bank/UPI, submit a reference number and confirm it shows up (as pending) on Admin → RSVP Payments, then Approve it and confirm the guest's status updates. If it's Stripe/Razorpay/CCAvenue, complete a real test payment and confirm you land back on a \"Payment received\" page and the row shows Paid in RSVP Payments.",
      },
    ],
  },
  {
    date: "Monday, August 10",
    items: [
      {
        title: "Clients can add their own payment method (owner-reviewed) — foundation for paid workshops",
        detail:
          "New \"My Payment Method\" page in the admin sidebar lets a host add their own bank/UPI details, or their own Stripe/Razorpay/CCAvenue keys, scoped to just their event. Submissions don't go live automatically — the owner reviews them on the new \"Payment Approvals\" page (owner-only) and approves or sends them back with a note; the client gets notified either way. This is the first piece of paid workshop registration — the RSVP payment step and per-session payments come next. Also added a \"Not satisfied with the templates available? We can design a custom one just for your event\" WhatsApp contact CTA on the Template picker (shows on both the admin Templates page and the wizard's Template step).",
        test:
          "As a client admin, open \"My Payment Method\" in the sidebar, pick a method (Bank/UPI, Stripe, Razorpay, or CCAvenue), fill in the fields, and submit — you should see a \"Pending review\" badge. As the owner, open \"Payment Approvals\" — the submission should appear with its details; approve it (or reject it with a note) and confirm the client's status badge updates and they get a notification. On any Template picker screen, confirm the \"Request a Custom Design\" button opens WhatsApp with a prefilled message.",
      },
    ],
  },
  {
    date: "Sunday, August 9 (newest of all)",
    items: [
      {
        title: "Wizard: go live for free when payment isn't set up yet",
        detail:
          "The payment step used to be a dead end if neither card checkout (Stripe/Razorpay/CCAvenue) nor manual UPI/QR/bank details were configured yet — the QR block just said \"Payment details haven't been set up yet\" with nothing else to do. That step now detects when there's genuinely nothing to pay through and shows a \"Go Live — Free for Now\" option instead, so a host isn't stuck. This is a temporary bypass, not a permanent free tier: the moment any real payment method is configured on the site, this option disappears on its own and the normal Pay Once / Subscribe / QR flow takes over — re-checked server-side every time, not just hidden client-side. Events activated this way are labeled \"Free (no payment configured)\" on the owner-only Billing page so they're easy to tell apart from a real payment or a promo code.",
        test:
          "With no Stripe/Razorpay/CCAvenue and no QR/UPI/bank details configured, walk a fresh draft through the wizard to the payment step — a gold \"Go Live — Free for Now\" panel with a \"Continue for Free\" button should appear instead of the old dead-end QR message. Clicking it should activate the event and land on the success page. Then configure any one payment method and repeat — the free option should no longer appear, and the normal payment UI should show instead. Check Admin → Billing — the free-activated event should show as \"Free (no payment configured)\".",
      },
    ],
  },
  {
    date: "Sunday, August 9 (even newer)",
    items: [
      {
        title: "Wizard: category-aware Honoree/Hosted By labels, fixed Date & Time, timezone picker, back links, and a slideshow bug fix",
        detail:
          "\"Honoree / Guest of Honor\" made no sense for a Reunion (or Corporate, Workshop, Education, Live Stream, Obituary) — those fields now relabel per category, e.g. Reunion shows \"Batch / Group Name\" and \"Organized By\" instead. Date & Time was a single combined field that silently blocked saving if you picked a date but not a time (read as an unexplained error) — now split into separate Date and Time inputs that always default the other half automatically. A Timezone picker + \"Detect\" button (same as Event Settings) is now available right in the wizard's Location section, not just after creating an account. Every wizard step that hid the shared footer (Event Details, Goals, Review) now shows a \"← Previous Step\" link again, matching every other step. Also fixed: the Slideshow step's \"Generate Video\" button could look completely unresponsive if a background-music re-upload failed silently — the error now shows right under the button, not just up by the audio picker.",
        test:
          "Start a new draft with Reunion as the Event Type — the Honoree field should read \"Batch / Group Name.\" On Event Details, pick just a date (no time) for Starts — it should default to 11:00 AM instead of blocking Save. Under Location, confirm a Timezone dropdown + Detect button appear. On Event Details, Goals, and Review, confirm a back link to the previous step now appears. On Slideshow, attach a music file, generate once successfully, then try generating again — if it ever fails, an error should now appear directly under the Generate Video button.",
      },
    ],
  },
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
