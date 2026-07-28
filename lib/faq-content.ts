/**
 * Fixed FAQ content for the admin dashboard's chatbot
 * (features/admin/support/faq-chatbot.tsx) — plain preset Q&A, no AI
 * involved, so it's free and predictable. Edit this list directly to
 * change what hosts see; no admin UI for it since it's meant to stay a
 * small, curated set you write yourself.
 */
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** When true, the chatbot renders a domain-request form instead of `answer` — see faq-chatbot.tsx. */
  isDomainRequest?: boolean;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "add-photos",
    question: "How do I add photos to my Gallery?",
    answer:
      "Go to Gallery in the sidebar, choose a category, and drag in photos (or tap to browse). You can add captions and reorder them afterward.",
  },
  {
    id: "change-template",
    question: "Can I change my template later?",
    answer:
      "Yes, anytime — go to Templates and pick a different one. All your content (photos, timeline, RSVP responses) carries over; only the colors, fonts, and animation style change.",
  },
  {
    id: "invite-guests",
    question: "How do I invite guests?",
    answer:
      "Add guests under Invitees, then use \"Generate Invitation Link\" for a unique, no-login link per guest — you can copy it or open it directly in WhatsApp.",
  },
  {
    id: "rsvp-tracking",
    question: "Where do I see who's coming?",
    answer:
      "Your Overview page shows RSVP counts at a glance; the Invitees page lists every guest's status (Coming / Maybe / Not Coming) individually.",
  },
  {
    id: "ai-image",
    question: "How does the AI Image tool work?",
    answer:
      "Describe the invitation card you want under AI Image, and it generates one from your description. You can regenerate as many times as your plan allows, then save it as your Gallery photo or Link Preview Image.",
  },
  {
    id: "slideshow",
    question: "How do I make a slideshow video?",
    answer:
      "Under Slideshow Video, pick photos from your Gallery and Timeline, set the pace, optionally add music, then render — it produces a real downloadable MP4.",
  },
  {
    id: "checkin",
    question: "How does Check-In work on the event day?",
    answer:
      "Open Check-In on your phone, search a guest by name, and tap to check them in. It updates live for anyone else with the page open too.",
  },
  {
    id: "custom-domain",
    question: "Can I use my own custom domain?",
    answer:
      "Yes — tell us the domain you'd like and we'll set up the routing and give you the DNS records to add on your end.",
    isDomainRequest: true,
  },
];
