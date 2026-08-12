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
    date: "Thursday, August 13",
    items: [
      {
        title: "Fixed: confirmation email links landed on the bare homepage with no \"verified\" message",
        detail:
          "Clicking \"Confirm your email\" was landing on the homepage with a stray, unused ?code=... in the URL and no indication anything worked. The confirmation link pointed straight at /login instead of through /auth/callback, so the code that proves you clicked a real link never actually got exchanged for a session — and since /login is a new page, it likely wasn't yet allow-listed in Supabase, so it silently fell back to the homepage instead. Confirmation links for all three account types (host, vendor, form-owner) now route through /auth/callback first, which exchanges the code properly and signs you in automatically before landing on /login with the \"Email verified\" banner.",
        test:
          "Sign up a new account (any of host registration, /business/signup, or a form-owner account), click the confirmation link in the email, and confirm you land on /login already signed in (a brief \"Signing you in...\" spinner, then straight into your dashboard) rather than a bare homepage with a leftover ?code= in the URL.",
      },
      {
        title: "Fixed: vendor signup claimed \"you're in\" but bounced to sign-in, same as the earlier forms bug",
        detail:
          "Business/vendor signup (/business/signup) had the same issue already fixed for Build RSVP / Form accounts: it always said \"You're in — taking you to your dashboard\" and redirected after a second, even though email confirmation is required, so it landed back on the sign-in page with no session. It now checks whether sign-up actually returned a session — if not, it shows \"Check your email, then come back and sign in\" instead, and your listing draft is still there once you do.",
        test:
          "Sign up a new vendor account at /business/signup and confirm you see \"Check your email\" (not \"You're in!\"). Click the confirmation link in the email, confirm it lands on /login with the \"Email verified\" banner, then sign in and confirm your listing draft is intact.",
      },
      {
        title: "One shared sign-in page for Admin, Business, and Build RSVP / Form",
        detail:
          "Admin, Marketplace vendor, and Build RSVP / Form accounts now share a single sign-in page at /login instead of three separate look-alike login screens. The old URLs (/admin/login, /business/login, /forms/login) still work — they just redirect to /login now, so nothing breaks if it's bookmarked. If one email happens to have more than one type of account, signing in takes you straight to the highest one — admin first, then Marketplace, then Build RSVP / Form — with no extra \"which dashboard?\" screen to click through.",
        test:
          "Visit /admin/login, /business/login, and /forms/login and confirm each lands on the same /login page. Sign in with an admin account and confirm it goes to /admin; sign in with a forms-only account and confirm it goes to /forms/dashboard.",
      },
    ],
  },
  {
    date: "Wednesday, August 12",
    items: [
      {
        title: "Fixed: creating a form-owner account claimed \"you're in\" but bounced to sign-in",
        detail:
          "Email confirmation is required on this project, so signing up for a form-owner account never actually logs you in right away — it just previously said \"You're in — taking you to your dashboard\" and then landed on the sign-in page, which looked broken. It now shows an honest \"Check your email, then come back and sign in\" message (same pattern as host/admin signup), and clicking the confirmation link takes you to /forms/login with an \"Email verified — you can sign in now\" banner so it's clear what to do next.",
        test:
          "Publish a form, create an account from the builder, and confirm you see \"Check your email\" (not a false \"You're in\"). Click the confirmation link in the email and confirm /forms/login shows the green \"Email verified\" banner, then sign in with the password you set.",
      },
      {
        title: "Icons on the RSVP-type picker + site header/footer on /forms/new",
        detail:
          "Each of the 8 \"what kind of RSVP is this\" cards on /forms/new (Step 1) now has its own icon. The wizard page was also missing the normal site header and footer entirely — it now has both, on all 3 steps, matching every other standalone tool page (Discover, AI Image, Submit a Template).",
        test:
          "Go to /forms/new and confirm a header with nav links and a footer are visible on Step 1, and stay visible through Step 2 and Step 3. Confirm each RSVP-type card has an icon.",
      },
      {
        title: "Renamed \"Build a Form\" to \"Build RSVP / Form\" everywhere",
        detail:
          "The nav link, the wizard heading at /forms/new, and the builder page label all now read \"Build RSVP / Form\" instead of \"Build a Form\" — makes it clearer up front that this tool is for RSVP-style forms as much as general ones, matching the new Step 1 \"what kind of RSVP is this\" picker.",
        test:
          "Check the nav on any page for \"Build RSVP / Form,\" then click it and confirm the wizard heading at /forms/new and the builder page label at /forms/build/[token] match.",
      },
      {
        title: "New \"Build a Form\" accounts now default to the RSVP dashboard view",
        detail:
          "Signing up for a form-owner account now starts you on the \"RSVP Forms Only\" view of your dashboard instead of \"All Forms\" — since most people using this tool are building RSVP forms, your dashboard opens already scoped to those. Switch to \"All Forms\" any time (top of /forms/dashboard) if you also build general-purpose forms and want to see everything. Existing accounts aren't affected.",
        test:
          "Build a form, publish it, and create a new account from the builder. Land on /forms/dashboard and confirm the toggle shows \"RSVP Forms Only\" selected by default.",
      },
      {
        title: "AI form generation now has a real cost report",
        detail:
          "Admin > Usage has a new \"Build a Form — AI Generation\" section: total estimated OpenAI cost, how many generations were \"Describe it\" vs \"Upload a form image,\" total tokens used, cost by RSVP type, and a 14-day trend. Token counts are real (pulled from OpenAI's own response on every call); the dollar figure is an estimate using a published per-token rate, same caveat as the AI Image/Shotstack numbers already on that page.",
        test:
          "Generate a form or two via AI (/forms/new, choose \"Generate with AI\"), then check Admin > Usage and confirm the \"Build a Form — AI Generation\" section shows the generation count and a non-zero cost.",
      },
      {
        title: "New form-builder wizard — pick an RSVP type, then AI or build-it-yourself",
        detail:
          "\"Build a Form\" now opens a short wizard instead of dropping you straight into an empty form. Step 1: pick what kind of RSVP it is (Wedding, Birthday, Baby Shower, Anniversary, Retirement, Corporate, Reunion, or General/Other). Step 2: generate it with AI or build it yourself — building it yourself now starts with a few suggested fields for that occasion already added (fully editable). Picking AI carries the occasion into the prompt, so a short description leans toward the right fields automatically. There's also a new self-service dashboard toggle — flip your account to \"RSVP Forms Only\" to hide any general-purpose forms you've built and see just the RSVP ones.",
        test:
          "Go to /forms/new and step through: pick \"Wedding,\" then \"Create It Yourself,\" and confirm the builder opens with starter fields like Meal Preference already added. Then start over, pick a category, choose \"Generate with AI,\" describe a form, and confirm it generates. On /forms/dashboard, try the \"All Forms\" / \"RSVP Forms Only\" toggle and confirm the list filters.",
      },
      {
        title: "AI form generation — describe a form or upload a photo of one, and the builder writes it for you",
        detail:
          "The Custom Form Builder now has a \"Build with AI\" panel at the top of the page. Type a sentence describing the form you want and AI writes the title, description, and every field. Or upload a photo/screenshot of an existing paper or PDF form and AI rebuilds it as a live EveryMoment form — the image is only analyzed once and never stored. Generating replaces the current fields, so it asks first if the form already has any.",
        test:
          "Go to /forms/new, choose a category, then \"Generate with AI,\" and try \"Describe it\" with something like \"a baby shower RSVP with meal choice and a gift note,\" and confirm the title and fields fill in. Then try \"Upload a form image\" with a photo of any form and confirm it's transcribed into fields.",
      },
      {
        title: "New: standalone Custom Form Builder — no login to build, own dashboard for responses",
        detail:
          "A brand-new, independent tool at /forms/new: build any kind of form (RSVP or otherwise) with a cover photo and custom fields — no account needed. Publish to get a shareable link, then optionally create a free account to search, edit, delete, export, and CSV-import responses in your own dashboard at /forms/dashboard. \"Build a Form\" is now in the nav on every page.",
        test:
          "Go to /forms/new, add a couple of fields, publish, and open the public link in a private window to submit a test response. Back on the builder, create an account and confirm the response shows up at /forms/dashboard.",
      },
      {
        title: "Spam protection added to the Custom Form Builder's public link",
        detail:
          "Anyone with a published form's link can submit without an account, so it now has the same spam guards as the RSVP form and memory uploads: a hidden trap field that silently ignores bot submissions, plus a per-visitor rate limit (10 submissions/hour per form) so a script can't flood a form or your inbox.",
        test:
          "No user-facing test needed for normal use — submitting a form normally is unaffected. If you want to verify the rate limit, submit the same form 10+ times quickly from one browser and confirm further attempts show a friendly \"try again later\" message.",
      },
      {
        title: "New \"Organizer\" role — delegate Invitees, Gallery, Timeline, and Check-In independently",
        detail:
          "A new dashboard role sits between Client and Session Organizer: someone can now run your guest list, photos, timeline, and event-day check-in on their own, without seeing Event Settings, billing, or any AI tools. Add one from Admin > Organizers (new nav link) the same way you'd add a team member — send an invite email or set a password yourself.",
        test:
          "Go to Admin > Organizers, add an organizer with a password, then sign in as them in a private window — confirm they can reach Invitees/Gallery/Timeline/Check-In and are redirected away from everything else (Event Settings, Memories, AI Image, etc.).",
      },
      {
        title: "Owner can now add a dashboard login right from Members",
        detail:
          "Admin > Members has a new \"Add Member\" button — pick which event, enter a name/email, and either send an invite email or set the password directly, without leaving the page. Previously this required going to Admin > All Events and using \"Create Login\" on that event's row instead.",
        test:
          "In Admin > Members, click \"Add Member\", pick an event, fill in a name/email, and send an invite (or set a password) — confirm the new row appears in the Members list with the right event.",
      },
      {
        title: "Fixed the AI Image tool's preview layout",
        detail:
          "The AI-generated invitation image was being cropped — the box forced a portrait shape onto what's actually a square image, cutting off the decorative border. It now shows the full image uncropped. Also fixed an issue where switching to \"Upload Your Own\" left a tall empty \"AI-generated image\" placeholder sitting above your actual upload.",
        test:
          "In Admin > AI Image, generate an image and confirm the full design (including its border) is visible, not cropped. Switch to \"Upload Your Own\" and upload a photo — confirm the preview appears right away with no empty box above it.",
      },
      {
        title: "New \"Support & Contribute\" page, linked from the footer",
        detail:
          "A new /donate page explains how to support the platform's growth (hosting/AI costs, referrals, feedback) and links out to WhatsApp. Added to the footer's Support column on every page using the full footer.",
        test: "Scroll to the footer on the homepage and confirm \"Support & Contribute\" appears under Support and opens the new page.",
      },
      {
        title: "Cleaned up WhatsApp message text",
        detail: "The pre-filled WhatsApp messages (Contact, Support, Custom Template Request, Studio/Agency plan) now open with a generic \"Hi,\" instead of a specific name.",
        test: "No user-facing test needed — just double-check any WhatsApp CTA link opens with \"Hi,\" not a name.",
      },
      {
        title: "Payment entity disclosure added to Contact Us",
        detail: "Contact Us now names Krushna Web Works as the entity that bills any paid plan and appears on the customer's card/bank statement — a disclosure payment gateways typically expect on a merchant's Contact page.",
        test: "Open /contact and confirm the \"Who You're Paying\" block appears below the form.",
      },
      {
        title: "New: email alert when a signup drops off at Create Account",
        detail:
          "The wizard's Create Account step now has an optional Mobile Number field. If someone hits an error creating their account, or types something in and leaves without finishing, Krushna Web Works gets an email at info@krushna53.com with whatever email/phone was captured — plus a one-tap WhatsApp link to follow up when a phone number was given.",
        test:
          "On /start, get to the Create Account step, type an email (and optionally a phone number), then close the tab or navigate away without submitting — confirm an email lands at info@krushna53.com shortly after.",
      },
      {
        title: "Floating \"See memories shared by others\" button on the public upload page",
        detail:
          "A guest who lands directly on an event's public /memories upload link now sees a floating gold button that jumps straight to that event's Memory Wall (in a new tab), so they can browse what others have already shared without hunting for the link themselves.",
        test:
          "Open any event's /events/[slug]/memories page and confirm the floating \"See memories shared by others\" button appears bottom-right and opens the event homepage scrolled to Memory Wall.",
      },
      {
        title: "AI-tool SEO pass — structured data, /llms.txt, explicit AI-crawler rules",
        detail:
          "Every event page now carries schema.org/Event structured data (name, date, venue, organizer), and the homepage carries Organization/WebSite data — so AI answer engines (ChatGPT, Perplexity, Google AI Overviews, Claude) can read accurate facts about an event instead of guessing from page text. Added a new /llms.txt summary page for AI assistants, and robots.ts now explicitly names the major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and others) alongside the existing rules.",
        test:
          "View source on any /events/[slug] page and confirm a <script type=\"application/ld+json\"> block with \"@type\":\"Event\" is present. Visit /llms.txt directly and confirm it loads as plain text.",
      },
    ],
  },
  {
    date: "Tuesday, August 11 (AI Timeline Movie)",
    items: [
      {
        title: "New \"AI Timeline Movie\" — narrated highlight video from your Timeline (HeyGen)",
        detail:
          "Admin > AI Timeline Movie: pick which Timeline milestones to include, pick an AI host avatar and voice, and it renders an MP4 where the avatar narrates each moment aloud with a matching photo behind them. Available to owner and client accounts (client-role capped at 2 AI renders per event by default). A separate \"Upload your own video\" tab lets you skip AI entirely. Requires a HeyGen API key (see README) — shows a friendly \"not configured\" message otherwise, and Upload still works either way. Finished movies show up in the Media Library alongside everything else.",
        test:
          "In Admin > AI Timeline Movie, select a few Timeline entries, pick an avatar/voice, and click Generate Movie — confirm it renders and plays back. Try the Upload tab with a short MP4 instead. Check the result appears in Admin > Media Library under \"Timeline Movies\" and can be deleted from there.",
      },
    ],
  },
  {
    date: "Tuesday, August 11",
    items: [
      {
        title: "Fixed a Netlify build failure blocking deploys",
        detail:
          "The Media Library admin page's client component was importing a value from a server-only module, which Next.js forbids and fails the whole build on — nothing new could go live until this was fixed. Moved the affected constants into a client-safe module; every other client component was audited for the same pattern and none had it.",
        test: "No user-facing test needed — this just unblocks deploys going forward.",
      },
      {
        title: "New \"Feature Video\" admin setting — show a promo/walkthrough video on the homepage",
        detail:
          "Admin > Feature Video lets the owner paste a YouTube/Vimeo link or upload an MP4/MOV file directly. When turned on, it shows in a \"See It In Action\" section on the public homepage, right below the hero and above the features grid. Off by default.",
        test:
          "In Admin > Feature Video, paste a YouTube link, turn it on, and save — confirm the section appears on the homepage with a working embed. Try the Upload tab with a short MP4 instead and confirm it plays with a native video player.",
      },
      {
        title: "Hid the Pricing page from navigation",
        detail: "Removed the \"Pricing\" link from the top nav and footer. The page itself still works at /pricing, just isn't linked from anywhere.",
        test: "Confirm \"Pricing\" no longer appears in the header or footer on the homepage.",
      },
      {
        title: "Fixed a console error and tightened up homepage/nav/footer width",
        detail:
          "Fixed a \"useInsertionEffect must not schedule updates\" error that could show up in the browser console during page navigation (caused by the top-loading progress bar). Also widened the header and footer to match the homepage's content width, fixing a layout mismatch that showed up as extra side padding on wide screens.",
        test: "Browse the site on a wide monitor and confirm the header, hero, and footer all line up with the same side margins, and confirm no console errors appear while navigating between pages.",
      },
    ],
  },
  {
    date: "Monday, August 10 (Live Stream embed)",
    items: [
      {
        title: "New \"Live Stream\" section — embed a YouTube Live or Facebook Live feed on your event page",
        detail:
          "In Event Settings, turn on Live Stream and paste a normal YouTube Live or Facebook Live share link — it embeds as its own section on your event homepage (reorderable/hideable like every other section), with a pulsing \"LIVE\" badge. This is the simple-embed approach (no new infrastructure or hosting cost) rather than a fully self-hosted streaming server — the stream itself still runs through YouTube/Facebook. Off by default, and the toggle is independent of the saved URL so you can turn it off between events without losing the link.",
        test:
          "In Event Settings, turn on Live Stream, paste a YouTube Live watch URL, save, and confirm the section appears on the event's public page with a working embedded player. Try reordering/hiding it in the Section Order manager and confirm the change reflects both in the live preview and on the real page after saving.",
      },
    ],
  },
  {
    date: "Monday, August 10 (Free public AI Image tool)",
    items: [
      {
        title: "New public \"AI Invitation Image\" tool at /ai-invitation-image — no account needed",
        detail:
          "A free, standalone marketing/lead-gen page where anyone can describe their event and get an AI-generated invitation image, with a \"Build Your Full Site\" call-to-action pointing at the wizard. Since this is reachable by anyone (not just logged-in admins) and calls a real pay-per-image API, it's rate-limited — 3 free images per visitor per day, 40 total per day platform-wide — enforced server-side so the limit can't be bypassed by calling the endpoint directly.",
        test:
          "Visit /ai-invitation-image in a private/incognito window, generate an image, and confirm it downloads correctly. Try generating 4 in a row from the same browser and confirm the 4th shows the daily-limit message instead of erroring.",
      },
    ],
  },
  {
    date: "Monday, August 10 (Share Collection links)",
    items: [
      {
        title: "\"Get Share Link\" — bundle several Media Library items into one shareable page",
        detail:
          "In Media Library, select multiple items (any mix of Gallery/Memory Wall/AI Images/Slideshow/Video Edits) and hit \"Get Share Link\" in the toolbar to get one link to a public page showing that whole selection — with WhatsApp/Facebook/X/Telegram/Email/Copy-Link buttons, same branded sharing as the existing single-photo share buttons. No login needed to view it, and nothing unapproved or deleted ever shows on the page even if the underlying items change later.",
        test:
          "In Media Library, select 2-3 items across different sections (e.g. a Gallery photo + an AI Image), click \"Get Share Link\", then open the resulting link in a private/incognito window and confirm all the selected items show up with working share buttons.",
      },
    ],
  },
  {
    date: "Monday, August 10 (Media Library)",
    items: [
      {
        title: "New Media Library — every photo/video/audio in one place, with bulk actions",
        detail:
          "A new \"Media Library\" page (in the main nav, Simple view, and App-Icon view) combines Gallery photos, approved Memory Wall uploads, AI Images, Slideshow Video renders, and Video Editor renders into one browsable grid with filter tabs. Select multiple items at once to Feature, Download, or Delete them together — Gallery/Memory Wall deletes go to the new Recycle Bin (30-day undo); AI Image/Slideshow/Video Edit deletes are immediate since those aren't guest-submitted content.",
        test:
          "Open Media Library, switch between the filter tabs (All/Gallery/Memory Wall/AI Images/Slideshow Videos/Video Edits), select a few items with the checkbox, and try the Feature/Download/Delete bulk actions in the toolbar that appears. Confirm a deleted Gallery/Memory Wall item shows up in Recycle Bin afterward.",
      },
    ],
  },
  {
    date: "Monday, August 10 (Recycle Bin + view switcher)",
    items: [
      {
        title: "Recycle Bin for deleted media (30-day undo) + a real Simple/Icons view switcher",
        detail:
          "Deleting a Gallery photo or a Memory Wall photo/video/audio in the admin no longer removes it right away — it moves to a new \"Recycle Bin\" page (in the main nav and in both the Simplified and App-Icon views) where it stays for 30 days, restorable with one tap, before it's automatically and permanently purged overnight. A \"Delete Forever\" button is also there if you want it gone immediately. Guest book messages are unaffected (text, not media, so they still delete immediately as before). Also added a proper List/Icons switcher to the top of both the Simplified view and the App-Icon view, so you can flip between the two with one tap instead of hunting for a link at the bottom of the page.",
        test:
          "In Gallery or Memories, delete a photo/video/audio item, then open Recycle Bin (nav, or from Simple/Apps view) and confirm it's listed with a \"Purges in 30 days\" note. Restore it and confirm it reappears in Gallery/Memories. Delete another item and use \"Delete Forever\" and confirm it's gone immediately. On /admin/simple and /admin/apps, use the new List/Icons switcher in the header to flip between the two views.",
      },
    ],
  },
  {
    date: "Monday, August 10 (after midnight)",
    items: [
      {
        title: "Fixed: AI Image generation erroring out with \"taking much longer than expected\"",
        detail:
          "Generating an invitation image (especially one asking for exact text like a name or date, which needs the AI's slower \"high quality\" rendering mode to come out legible) could genuinely take over 90 seconds — but the browser was giving up and showing an error at exactly 90 seconds, even though the image was still being generated successfully on the server. Raised that limit well past what the server itself allows, so the browser only gives up if the server actually would have too. Also added a live \"Ns elapsed\" counter next to the loading message so it's obvious it's still working during a longer wait instead of looking frozen.",
        test:
          "Generate an AI invitation image with a detailed, text-heavy prompt (the kind that takes longest) and confirm it completes successfully even past the one-minute mark, with the elapsed-seconds counter visibly ticking up the whole time.",
      },
    ],
  },
  {
    date: "Monday, August 10 (near midnight)",
    items: [
      {
        title: "App-icon launcher page, global page-load spinner, and a round of UI fixes",
        detail:
          "New \"App Icons\" view (linked from the Simplified view and the main dashboard) — every page a client can reach as a big colorful rounded icon, phone-home-screen style, with a badge on Memories when something's waiting for approval. Also this round: a gold progress bar now sweeps across the top of the page on every click/navigation site-wide, so nothing feels unresponsive while the next page loads; fixed the Submit-a-Template color picker (the swatch and hex box now actually stay in sync); fixed a stray horizontal scroll in the header; the site logo now actually goes somewhere on every page (it used to only work on the homepage); removed Testimonials from the homepage and widened the hero; bigger footer and feature-card text; Pricing page text bumped up; the onboarding wizard now has a way back to the main site (previously trapped you with no exit); wizard textareas no longer show a resize handle; the Invitation Card generator has a proper loading skeleton with live status text instead of a plain \"Generating...\" box; fixed an invalid HTML nesting bug and combined/aligned the \"Create Account\" and \"View Your Site\" buttons on the Review step; the Create Account form is now two columns on desktop.",
        test:
          "Click around the public site and admin — confirm the gold progress bar shows on every navigation. Visit /admin/apps as a client and confirm every tile opens the right page. Try Submit a Template's color pickers (swatch and hex box should always match). Check the homepage, footer, and Pricing page for the larger text. Walk through /start end to end — confirm the wizard header has a logo/Exit link, the Invitation Card step shows a nice loading state, and the Review → Create Account flow has two aligned buttons.",
      },
    ],
  },
  {
    date: "Monday, August 10 (very late night)",
    items: [
      {
        title: "Branded social share buttons on every Gallery and Memory Wall photo/video (task #80)",
        detail:
          "Every photo/video card (site Gallery and the Memory Wall) now has a third button next to Download/Share — a small menu with WhatsApp, Facebook, X, Telegram, and Email share links, plus Copy Link. Unlike the existing native-Share button (which hands guests the raw file for their phone's own share sheet), these open a proper webpage for that one item first — a new public /p/[kind]/[id] link with a real preview card (title, description, image) — since WhatsApp/Facebook/X/Telegram all build their link-preview by crawling a page's tags, not a bare file URL. That page also shows the item full-size with a link back to the event site. Guest-uploaded photos/videos only get one of these links once an admin has approved them on Memories — same as they already had to be to show up on the Memory Wall at all.",
        test:
          "On the public Gallery or Memory Wall, click the new link-style button on any photo or video, then WhatsApp — confirm it opens WhatsApp Web/app with a message containing a link. Open that link directly and confirm it shows the photo/video with a proper page (not a raw file), and that pasting the link into a WhatsApp/Telegram chat shows an image preview card. Try Copy Link too and confirm it copies successfully (shows \"Copied!\").",
      },
    ],
  },
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
