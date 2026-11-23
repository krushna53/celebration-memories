// The wedding reel shown on /wedding/reels, and where guests go to pick a template.

/** Where a guest goes to pick and personalise a template (invitation cards use it too). */
export const TEMPLATE_STORE_URL = "https://everymomentwedding.netlify.app/templates?event=wedding";

/** The sample reel: envelope film, haldi, cocktail and baraat scenes with their date cards. */
export const FEATURED_REEL = {
  slug: "wedding-film",
  title: "Wedding Film Reel",
  src: "/reels/wedding-invitation-reel.mp4",
  poster: "/reels/wedding-reel-poster.jpg",
  length: "1:36",
};

export const REELS = [FEATURED_REEL];

const P = "/art/couples/";

/**
 * Animated reel templates. Each one is drawn live in the browser (TemplateReel), so every word on it can be
 * edited in the reel studio at /ai-reel?template=<slug>. `prompt` is the matching brief for "Create AI video".
 * Ideas only loosely follow popular invitation reels; the art and motion are our own.
 */
export const REEL_TEMPLATES = [
  {
    slug: "website-tour",
    look: "tour",
    title: "Website Tour",
    length: "0:20",
    tag: "Show off your wedding website",
    blurb: "A phone glides in and walks guests through your site: the welcome, every ceremony, the countdown and RSVP.",
    defaults: { bride: "Ishita", groom: "Kabir", date: "12 December 2026", time: "7:00 PM", venue: "Leela Palace, Jaipur", ceremony: "Wedding Ceremony", family: "everymoment.in/ishita-kabir" },
    prompt: "Create a sleek 9:16 promotional reel for a couple's wedding website. Deep emerald backdrop with a soft glowing halo; a modern phone floats in at an angle and its screen scrolls through an elegant invitation page — a palace welcome, ceremony cards, a countdown and an RSVP button. Smooth parallax, gentle camera drift, premium product-film lighting. Keep the left third clear for editable feature labels. No logos, no spoken dialogue.",
  },
  {
    slug: "lantern-sangeet",
    look: "sangeet",
    title: "Lantern Sangeet",
    length: "0:16",
    tag: "Illustrated dance night",
    blurb: "A dusk sky, swinging fairy lights and a lantern tree — the couple dances while each function card floats up.",
    defaults: { bride: "Meera", groom: "Arjun", date: "18 January 2027", time: "8:00 PM onwards", venue: "The Banyan Lawns, Udaipur", ceremony: "Sangeet Night", family: "" },
    prompt: "Create a dreamy 9:16 illustrated sangeet invitation reel. A lilac-to-peach dusk sky with a large soft moon, strings of warm bulbs gently swinging, and a wide old tree hung with glowing lanterns. Under it the illustrated couple dance with friends, fabric twirling. Hand-painted storybook style, fireflies drifting, slow camera push-in. Keep the upper third open for editable ceremony lettering. No logos, no spoken dialogue.",
  },
  {
    slug: "royal-scroll",
    look: "scroll",
    title: "Royal Scroll",
    length: "0:18",
    tag: "Unrolling patrika",
    blurb: "Two velvet rollers part to unroll a hand-painted patrika, then the date drops in tile by tile.",
    defaults: { bride: "Ananya", groom: "Vihaan", date: "11 October 2026", time: "Muhurat 7:30 PM", venue: "Umaid Bhawan, Jodhpur", ceremony: "Shubh Vivah", family: "" },
    prompt: "Create a regal 9:16 animated wedding patrika reel. Two maroon velvet scroll rollers with gold finials part vertically to unroll an ivory hand-painted scroll with a lotus mandala, kalash motifs and fine gold borders. Date tiles drop in one by one. Rich textures, soft studio light, slow precise motion. Keep the centre of the scroll clear for editable names and dates. No logos, no spoken dialogue.",
  },
  {
    slug: "royal-cinema",
    look: "cinema",
    title: "Royal Cinema",
    length: "0:20",
    tag: "Cinematic save the date",
    blurb: "Letterboxed, slow-zoom scenes with film grain and a light leak — one grand frame for each ceremony.",
    defaults: { bride: "Sanya", groom: "Rudra", date: "6 May 2027", time: "7:00 PM", venue: "City Palace, Udaipur", ceremony: "Save the Date", family: "" },
    photos: [P + "couple-rajasthani-gulabi.webp", P + "couple-rosewood-vows.webp", P + "couple-moonlit-courtyard.webp", P + "couple-lotus-dawn.webp"],
    prompt: "Create a cinematic 9:16 royal Indian wedding save-the-date. Use the uploaded couple photo as identity reference. Scene 1: the couple exchange varmala in a palace courtyard at golden hour, surrounded by family. Scene 2: the groom arrives on a decorated chariot through an old city street for the baraat. Scene 3: a quiet candlelit moment together. Epic film lighting, shallow depth of field, anamorphic flares, slow dolly moves. Keep the bottom third clear for editable ceremony titles. No logos, no spoken dialogue.",
  },
  {
    slug: "shaadi-ka-ghar",
    look: "ghar",
    title: "Shaadi ka Ghar",
    length: "0:18",
    tag: "Storytelling invite",
    blurb: "A marigold-draped haveli, subtitles that tell the story, and carved doors that swing open on the couple.",
    defaults: { bride: "Pooja", groom: "Rohan", date: "24 February 2027", time: "11:00 AM", venue: "Sharma Niwas, Lucknow", ceremony: "Wedding Ceremony", family: "Sharma Parivar" },
    prompt: "Create a warm 9:16 illustrated storytelling wedding invitation. Open on a sage-green Indian family home draped in marigold garlands with a hand-painted sign 'Shaadi ka Ghar'. Carved wooden doors swing open into a cosy lamp-lit courtyard where the family is getting ready, a pet dog wags by, and the illustrated couple smile together. Gentle storybook animation, soft daylight, subtitle-style captions area at the bottom. No logos, no spoken dialogue.",
  },
];

/** Default ceremony list a template starts with; the studio lets the couple edit every row. */
export const TEMPLATE_EVENTS = {
  tour: [{ name: "Mehendi", when: "10 Dec · 4 PM" }, { name: "Sangeet", when: "11 Dec · 8 PM" }, { name: "Wedding", when: "12 Dec · 7 PM" }],
  sangeet: [{ name: "Haldi", when: "17 Jan · 10 AM" }, { name: "Sangeet", when: "18 Jan · 8 PM" }, { name: "Reception", when: "19 Jan · 7 PM" }],
  scroll: [{ name: "Tilak", when: "9 Oct · 11 AM" }, { name: "Mehendi", when: "10 Oct · 5 PM" }, { name: "Vivah", when: "11 Oct · 7:30 PM" }],
  cinema: [{ name: "Haldi", when: "4 May · 10 AM" }, { name: "Baraat", when: "6 May · 6 PM" }, { name: "Pheras", when: "6 May · 9 PM" }],
  ghar: [{ name: "Haldi", when: "22 Feb · 10 AM" }, { name: "Mehendi", when: "23 Feb · 4 PM" }, { name: "Shaadi", when: "24 Feb · 11 AM" }],
};

/** Subtitle lines for the storytelling template; editable in the studio. */
export const GHAR_CAPTIONS = ["Dekho, ek ghar mein shaadi hai…", "Ghar ki chhoti si duniya, aaj thodi badi ho gayi", "Aur iss khushi mein, aap bhi shaamil hain"];

export const reelTemplate = (slug) => REEL_TEMPLATES.find((item) => item.slug === slug);
