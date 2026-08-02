import Link from "next/link";

interface GuideSection {
  title: string;
  items: { label: string; body: string }[];
}

const SECTIONS: GuideSection[] = [
  {
    title: "Overview",
    items: [
      {
        label: "/admin",
        body: "RSVP breakdown (coming/maybe/not coming), upload counts by type, most active guests, and recent activity at a glance.",
      },
    ],
  },
  {
    title: "Event Settings",
    items: [
      {
        label: "Who & What",
        body: "Hosted For (the honoree's name), Hosted By, Occasion label, and the poetic tagline shown under the honoree's name.",
      },
      {
        label: "Date & Time",
        body: "The celebration's start/end — drives the countdown, RSVP window, and every date/time shown on the site. If the real occasion (e.g. an actual birthdate) falls on a different day than the party, add it separately as the Actual Occasion Date — it's optional and shows as an extra detail card.",
      },
      {
        label: "Location",
        body: "Venue name/address, Google Maps directions + embeddable map, parking notes, dress code.",
      },
      {
        label: "Timezone",
        body: "Every event has its own timezone, so guests anywhere in the world see the correct time for the venue rather than whatever server or browser happens to render the page. Tap Detect to set it automatically from the venue address, or choose one manually from the dropdown.",
      },
      {
        label: "Public Listing",
        body: "Toggle Public/Private. Public events appear on the /events directory with your short description. Private events are still reachable at their direct link — this only controls the directory listing.",
      },
      {
        label: "Section Order & Visibility",
        body: "Drag to reorder, or tap the eye icon to hide, any homepage section — Countdown, Invitation, Event Details, Gallery, Timeline, RSVP, Wish Message, Memory Wall. Hero always shows first. Handy for a simple site that only needs a couple of sections.",
      },
      {
        label: "WhatsApp Invite Message",
        body: "Write your own invite wording using {{name}}, {{link}}, {{hostedBy}}, and {{honoreeName}} placeholders — a live preview shows exactly what each guest will see. Leave it blank to use the default wording.",
      },
      {
        label: "Public RSVP Link",
        body: "Off by default (RSVP only via each guest's personal link). Turn it on to open a self-service RSVP page anyone with the link can use, matched by phone number — useful for large or informal guest lists where collecting every phone number ahead of time isn't practical.",
      },
      {
        label: "Custom CSS",
        body: "For fine-tuned visual tweaks beyond what a template offers. Use \"Generate with AI\" to describe a style change in plain language (e.g. \"make the section headings larger\") and have it written for you — review before saving either way.",
      },
    ],
  },
  {
    title: "AI Avatar",
    items: [
      {
        label: "What it is",
        body: "An optional chat widget on your event's homepage that acts as a friendly host/greeter for guests — it can answer questions about the event and nudge visitors toward RSVPing, uploading a memory, or playing a game. It speaks its replies out loud and guests can talk back instead of typing.",
      },
      {
        label: "Turning it on",
        body: "In Event Settings, switch AI Avatar on and set a daily message limit (a simple safety cap on usage, since every message costs a small amount to generate). Once enabled it appears automatically on your public event page — no extra setup needed.",
      },
    ],
  },
  {
    title: "Event Day",
    items: [
      {
        label: "/admin/event-day",
        body: "Build a time-blocked schedule for the day (e.g. \"11am–12pm Cake Cutting, 12–1pm Lunch\") and share the menu — buffet or à la carte, with dietary tags per item. Guests view it from a dedicated Event Day page.",
      },
      {
        label: "Public vs. private",
        body: "Choose whether the schedule/menu page is open to anyone with the link (like the Timeline) or gated behind a quick phone-number check against your invitee list.",
      },
    ],
  },
  {
    title: "Templates",
    items: [
      {
        label: "/admin/templates",
        body: "Pick your site's look from the template gallery. Every template uses the exact same sections — only colours, fonts, and animation style differ. Changes apply immediately.",
      },
    ],
  },
  {
    title: "Invitees & sending unique invite links",
    items: [
      {
        label: "Add a guest",
        body: "/admin/invitees → Add Invitee. A unique token and link (yoursite.com/invite/<token>) are generated automatically the moment you save.",
      },
      {
        label: "Bulk import",
        body: "Use CSV Import with columns name,phone,email,relationship to add many guests at once.",
      },
      {
        label: "Send the link",
        body: "On each guest's row: Copy Link copies their personal URL, and the WhatsApp button opens a pre-filled WhatsApp message (via wa.me) with their name and link already in the text — just hit send. Each guest's link is unique to them, so their RSVP, uploads, and visit tracking are always attributed correctly with no login needed.",
      },
      {
        label: "What guests see",
        body: "Opening their link auto-identifies them by name, shows the invitation, and lets them RSVP, upload photos/video/audio, and sign the guest book — all from that one link.",
      },
    ],
  },
  {
    title: "Gallery & Timeline",
    items: [
      {
        label: "/admin/gallery",
        body: "Upload photos into categories (Childhood, Wedding, Family, Friends, Travel, Grandchildren — or whichever apply). Shows up in the public Gallery filters immediately.",
      },
      {
        label: "/admin/timeline",
        body: "Add life-story milestones with period/title/description, reorder with the up/down arrows. The public Timeline section stays hidden until at least one milestone exists.",
      },
    ],
  },
  {
    title: "Memories",
    items: [
      {
        label: "/admin/memories",
        body: "Every guest upload (photo/video/audio) and guest book entry sits here for approval before it appears on the public Memory Wall. Approve, feature, or delete each item.",
      },
    ],
  },
  {
    title: "Check-In",
    items: [
      {
        label: "/admin/checkin",
        body: "On event day, search a guest by name and tap to check them in. See live attendance as guests arrive; undo is available if needed.",
      },
    ],
  },
  {
    title: "AI Image & Slideshow Video",
    items: [
      {
        label: "/admin/ai-image",
        body: "Describe an image in a sentence and generate one — for a link-preview image, a gallery photo, or inspiration for a printed invitation. You can also upload your own image on the same page if you'd rather skip generation entirely.",
      },
      {
        label: "/admin/slideshow",
        body: "Turn your Gallery and Timeline photos into a real music-backed highlight video — pick photos, set the pace, optionally add captions, then render. The finished video can be used directly as your Link Preview Video.",
      },
    ],
  },
  {
    title: "Games & Planner",
    items: [
      {
        label: "/admin/games",
        body: "Set up Word Search or Housie (Tambola)-style games for guests to play from their own phone — share a link or QR code, and watch scores/prize claims live.",
      },
      {
        label: "/admin/planner",
        body: "A simple to-do board and sticky notes for the planning process itself — share one link with family so everyone can help without needing their own login.",
      },
    ],
  },
  {
    title: "Domain Search",
    items: [
      {
        label: "/admin/domain-search",
        body: "Search for a custom domain for your event (e.g. yourname.com) and see live availability and pricing. Purchasing happens on the registrar's own site — once you own the domain, point its DNS at this platform to use it.",
      },
    ],
  },
  {
    title: "Sharing & downloads",
    items: [
      {
        label: "/admin/share-image",
        body: "Compose a downloadable invitation card image with your event details — optionally use a photo as the background. Download it, or use Share on a phone to send it straight into WhatsApp.",
      },
      {
        label: "Download All Media",
        body: "On /admin/memories, the \"Download All Media (.zip)\" button bundles every guest photo/video/audio upload into one zip file for backup.",
      },
    ],
  },
  {
    title: "Referrals",
    items: [
      {
        label: "/admin/referrals",
        body: "Create a shareable referral link for anyone promoting the platform in their own WhatsApp groups. Visit counts track automatically; log conversions and reward payouts manually — there's no automated payment.",
      },
    ],
  },
  {
    title: "Inquiries",
    items: [
      {
        label: "/admin/inquiries",
        body: "Messages submitted through the public Contact Us page land here — mark each as read once handled.",
      },
    ],
  },
];

/**
 * Admin-facing feature walkthrough. Kept as one page (rather than
 * scattering tooltips) so it's easy to keep in sync as features change —
 * update SECTIONS above when a feature is added or changed.
 */
export default function AdminHelpPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl text-navy-950">How To Use This Dashboard</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Everything you can do from the admin panel, in one place.
      </p>

      <div className="mt-8 grid gap-6">
        {SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-xl border border-navy-950/10 bg-white p-5"
          >
            <h2 className="font-display text-lg text-navy-950">{section.title}</h2>
            <dl className="mt-3 grid gap-3">
              {section.items.map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-medium uppercase tracking-[0.15em] text-gold-600">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-navy-700/80">{item.body}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-navy-700/60">
        Want to see what guests experience?{" "}
        <Link href="/guide" className="text-gold-600 underline underline-offset-2">
          View the visitor guide
        </Link>
        .
      </p>
    </div>
  );
}
