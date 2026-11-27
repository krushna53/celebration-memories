// Sample wedding websites for /wedding/webpages with fictional couples, each showing a different opening
// (envelopes, curtains, doors…) onto its own page design (PAGES), with its own colours, fonts and closing.
// Every name, venue and family here is made up; nothing is tied to a real client or event.
import { sampleDefaults, colorFields, buildInvitation } from "@/features/sacred-garden/lib/invitation-form";
import { COLOR_PRESETS } from "@/features/sacred-garden/lib/sacred-garden";

const preset = (name) => colorFields(COLOR_PRESETS.find(([label]) => label.startsWith(name))[1]);
const P = "/art/couples/";

/** Opening styles: [group, what guests see]. */
export const STYLES = {
  film: ["envelope", "Wax-seal envelope film"],
  seal: ["envelope", "Envelope with the couple's initials on the seal"],
  pocket: ["envelope", "Pocket fold: the band slips off, the card slides out"],
  gatefold: ["envelope", "Gatefold flaps that swing open from a gold seal"],
  lasercut: ["envelope", "Laser-cut jali envelope over a gold liner"],
  airmail: ["envelope", "Airmail letter that turns over and opens"],
  ribbon: ["envelope", "Envelope tied with a silk ribbon and bow"],
  waxenvelope: ["envelope", "Real paper envelope: the wax seal breaks and the card slides out"],
  velvet: ["curtain", "Silk drape you drag or tap open"],
  stagevelvet: ["curtain", "Real velvet stage curtains that gather into folds"],
  theatre: ["curtain", "Theatre stage, spotlights and a marquee sign"],
  sunlit: ["curtain", "Chiffon blowing open in a sunlit window"],
  satin: ["curtain", "Blush satin drapes under swags of pearls"],
  mandap: ["curtain", "Mandap pillars and marigold strings"],
  lace: ["curtain", "Lace panels drawn aside around a cameo"],
  cabana: ["curtain", "Beach cabana linen in the sea breeze"],
  lights: ["curtain", "A curtain of fairy lights that parts"],
  rise: ["curtain", "Theatre curtain that rises"],
  sheer: ["curtain", "Layered chiffon with fairy lights"],
  swag: ["curtain", "Drapes that gather into the corners"],
  double: ["curtain", "Velvet, then lace"],
  marigold: ["curtain", "Marigold strings that part"],
  pearls: ["curtain", "Pearl strings that part"],
  petals: ["curtain", "Stage curtains with a burst of petals"],
  temple: ["doors", "Temple doors with bells and a toran"],
  teakdoor: ["doors", "Real carved teak doors with brass knockers"],
  sheeshmahal: ["doors", "Moonlit Sheesh Mahal palace doors swing open from a carved arch"],
  jali: ["doors", "Jali screens in a Mughal arch"],
  haveli: ["doors", "Arched haveli doors with brass studs"],
  glass: ["doors", "Frosted chapel doors"],
  sage: ["doors", "Embossed garden doors"],
  monogram: ["doors", "Doors with a monogram seal"],
  flowerdoor: ["doors", "Blush floral invitation doors open from a centre seal"],
  none: ["none", "Straight to the page"],
};

/** What the page looks like once it opens: [short name, what guests see]. "garden" is the Sacred Garden design. */
export const PAGES = {
  garden: ["Sacred Garden", "Painted florals on torn paper"],
  editorial: ["The Wedding Issue", "A glossy magazine cover, contents and feature spread"],
  scroll: ["Royal Patrika", "A parchment scroll with a marigold toran and diyas"],
  sheeshmahal: ["Sheesh Mahal", "A mirror-palace wedding story in midnight blue, antique gold and carved arches"],
  ticket: ["Flight to Forever", "Boarding pass, split-flap departures board, postcard"],
  scrapbook: ["Scrapbook", "Taped polaroids, sticky notes and a tear-off calendar"],
  celestial: ["Written in the Stars", "Night sky, crescent moon and glowing countdown rings"],
  modern: ["Modern Grid", "Oversized numerals, a moving marquee and clean lines"],
  arches: ["Arches & Jali", "Arched windows, lattice pattern and swinging lanterns"],
  luxe: ["Black & Gold", "A gold-foil monogram crest on midnight black"],
  filmstrip: ["Premiere Night", "A film strip of photos, cinema tickets and a reel countdown"],
  watercolor: ["Watercolour Garden", "A painted floral wreath and a winding timeline"],
  sunset: ["Golden Hour", "Sunset gradients and a sun that rises as you scroll"],
  minimal: ["Quiet Minimal", "Fine type, wide margins and a single hairline"],
  newspaper: ["The Daily Vows", "A broadsheet front page with headlines and columns"],
  azulejo: ["Goan Tiles", "Blue azulejo tiles, a scalloped awning and sea views"],
  deco: ["Art Deco Gala", "Navy and gold sunbursts and a geometric crest"],
  kasavu: ["Kasavu", "Ivory and gold borders like a Kerala kasavu saree"],
  alpona: ["Alpona", "White alpona motifs on red, like a Bengali wedding floor"],
  paisley: ["Bandhani & Paisley", "Tie-dye dots and paisleys in festive colours"],
  pearl: ["Pearl & Blush", "Strings of pearls, blush satin and soft script"],
  phulkari: ["Phulkari", "Bright embroidered geometry from a Punjabi phulkari"],
  floralinvite: ["Blush Floral Invitation", "A phone-friendly floral invitation with a cover, countdown, schedule and RSVP"],
};

/**
 * The opening's colours for each page design ({ main, dark, trim, ink }: cloth / paper / doors, their shadow, gold work,
 * lettering), so the envelope, curtain or doors are cut from the same cloth as the page behind them. Designs whose
 * colours come from the couple's own (the rest) follow those, so the opening changes with them in the editor.
 */
export const PAGE_PALETTE = {
  scroll: { main: "#7a1424", dark: "#2a0508", trim: "#d8a63c", ink: "#fff3d6" },
  scrapbook: { main: "#c9a87a", dark: "#5a4030", trim: "#a2412b", ink: "#3b2a1a" },
  celestial: { main: "#24407a", dark: "#0a1030", trim: "#f6e2a8", ink: "#fff" },
  luxe: { main: "#1a1712", dark: "#050403", trim: "#d4b46a", ink: "#f6e2a6" },
  filmstrip: { main: "#8a1424", dark: "#121014", trim: "#f2c14e", ink: "#fff3d6" },
  kasavu: { main: "#f6eedb", dark: "#8a6a1c", trim: "#c9a227", ink: "#3a2a18" },
  azulejo: { main: "#1f4f9a", dark: "#0b2550", trim: "#f2e3c0", ink: "#fff" },
  deco: { main: "#1b2a52", dark: "#070d1c", trim: "#d8b35d", ink: "#f2e6c9" },
  alpona: { main: "#9b1c22", dark: "#4a0a0e", trim: "#ffffff", ink: "#fff3e6" },
  phulkari: { main: "#d6336c", dark: "#5a0f2a", trim: "#f5a623", ink: "#fff6e2" },
  newspaper: { main: "#f4f0e6", dark: "#1a1a1a", trim: "#8b1a1a", ink: "#1a1a1a" },
};

/** The colours a sample's opening is drawn in: its page design's, else from the couple's own colours. */
export function openingColors(site, colors) {
  const k = colors ?? { accent: site.form.colorAccent, button: site.form.colorButton, detail: site.form.colorDetail };
  return PAGE_PALETTE[site.page] ?? { main: k.accent, dark: k.button, trim: k.detail, ink: "#fff" };
}

// which page each sample opens onto: every sample has its own
const PAGE_OF = {
  "karan-ananya": "garden", "rehan-simran": "phulkari", "vihaan-ira": "celestial", "arjun-meher": "scroll",
  "ishaan-naina": "ticket", "pranav-avni": "luxe",
  "rohan-ishita": "editorial", "aditya-nisha": "filmstrip", "vivaan-tara": "sunset", "samar-riya": "pearl",
  "dev-kavya": "paisley", "yash-sneha": "scrapbook", "neil-zara": "azulejo", "aryan-diya": "deco",
  "siddharth-pooja": "kasavu", "ayaan-sara": "arches", "raghav-mira": "alpona", "manav-tanvi": "modern",
  "aarya-kabir-blush": "floralinvite", "veer-meera-sheesh-mahal": "sheeshmahal",
  "jay-prisha": "watercolor", "daniel-anika": "minimal", "omkar-gauri": "newspaper",
};

// envelope seal colours: the film's red seal turned (hue in degrees) to another wax colour
export const SEAL_TINTS = { red: 0, emerald: 140, sapphire: 220, plum: 290 };

const blessing = "॥ श्री कृष्णाय नमः ॥"; // the default blessing line; samples of other traditions set their own

const hinduDays = [[-1], ["11am onwards", "Haldi Ceremony"], ["4pm onwards", "Mehendi"], ["8pm onwards", "Sangeet Night"],
  [0], ["5pm onwards", "Baraat"], ["7:30pm onwards", "Pheras"], ["9pm onwards", "Reception Dinner"]];

/** [slug, title, blurb, style (STYLES), form fields (over sampleDefaults), extra: { colors?, fabric?, curtain?, doors?, tint? }] */
const RAW = [
  ["karan-ananya", "Classic Envelope", "The signature wax-seal envelope opens onto ivory paper and gold lettering.", "film", {
    groom: "Karan", bride: "Ananya", date: "2027-02-14T19:30", hashtag: "#KarAnanyaForever",
    groomParents: "S/O Mrs. Meera & Mr. Arvind Malhotra", brideParents: "D/O Mrs. Sunita & Mr. Prakash Iyer",
    program: hinduDays, venueName: "The Marigold Palace — Sample Venue", venueAddress: "Lake Road, Udaipur, Rajasthan", venueMap: "Udaipur, Rajasthan",
    heroPhoto: `${P}couple-rosewood-vows.webp` }],
  ["rehan-simran", "Rani Pink Pocket Fold", "A rani-pink pocket envelope with a marigold-gold belly band: the band slips off and the card slides out onto a phulkari page.", "pocket", {
    groom: "Rehan", bride: "Simran", date: "2027-03-06T18:00", dateFormat: "long", couplePhoto: `${P}couple-lotus-dawn.webp`, ...preset("Maroon"),
    venueName: "Rosewater Gardens — Sample Venue", venueAddress: "Sarjapur Road, Bengaluru, Karnataka", venueMap: "Bengaluru, Karnataka",
    fontNames: "Parisienne", fontBody: "Cormorant Garamond" }, { colors: { main: "#d6336c", dark: "#5a0f2a", trim: "#f5a623", ink: "#5a0f2a" } }],
  ["vihaan-ira", "Sapphire Gatefold, Auto-Play", "Sapphire gatefold flaps held by a gold seal swing open by themselves, then the page glides through every section.", "gatefold", {
    groom: "Vihaan", bride: "Ira", date: "2027-01-24T11:00", autoOpen: "2", autoScroll: "on", ...preset("Royal blue"), dateFormat: "day",
    hashtag: "#VihaanKiIra", venueName: "Haveli Sundaram — Sample Venue", venueAddress: "Civil Lines, Jaipur, Rajasthan", venueMap: "Jaipur, Rajasthan" }, { colors: { main: "#2f4a8a", dark: "#0c1530", trim: "#d9b45a", ink: "#2f3a6a" } }],
  ["arjun-meher", "Wax-Sealed Maroon Envelope", "A real maroon paper envelope on a walnut table: the gold wax seal breaks, the flap lifts and the card slides out onto a royal patrika scroll.", "waxenvelope", {
    groom: "Arjun", bride: "Meher", date: "2027-11-27T20:00", ...preset("Maroon"), fontScript: "Great Vibes", fontBody: "Playfair Display",
    blessing: "ੴ ਸਤਿ ਨਾਮੁ", program: [[-1], ["11am", "Akhand Path & Kirtan"], ["3pm", "Mehendi"], ["7pm onwards", "Sangeet & Cocktails"], [0], ["9am", "Anand Karaj"], ["1pm", "Lunch"], ["8pm onwards", "Reception"]],
    venueName: "Golden Fields Estate — Sample Venue", venueAddress: "GT Road, Amritsar, Punjab", venueMap: "Amritsar, Punjab" }, { colors: { main: "#7a1424", dark: "#24050a", trim: "#d9a441", ink: "#5a1020" } }],
  ["ishaan-naina", "Airmail Letter, Lavender", "A striped airmail envelope with a stamp and postmark turns over, opens, and the letter slides out.", "airmail", {
    groom: "Ishaan", bride: "Naina", date: "2027-06-19T18:00", ...preset("Lavender"), dateFormat: "long", closingLayout: "bleed",
    couplePhoto: `${P}couple-moonlit-courtyard.webp`, hashtag: "#IshNainaHoGaya",
    venueName: "The Lavender Terrace — Sample Venue", venueAddress: "Shimla, Himachal Pradesh", venueMap: "Shimla, Himachal Pradesh" },
    { colors: { main: "#e4dcef", dark: "#2b2140", trim: "#7a5c9e", ink: "#4b3570" } }],
  ["pranav-avni", "Ribbon & Bow Envelope", "A black envelope tied with gold silk ribbon: the bow unties, the flap lifts and the card rises out onto a black-and-gold page.", "ribbon", {
    groom: "Pranav", bride: "Avni", date: "2027-02-19T19:00", hashtag: "#PranavKiAvni", fontNames: "Pinyon Script", fontBody: "Marcellus",
    colorAccent: "#c9a052", colorText: "#e9e2d0", colorBackground: "#0e0d0b", colorDetail: "#8a7a55", colorTime: "#d8c38e", colorButton: "#b8862e",
    program: [[-1], ["5pm", "Mehendi"], ["8pm onwards", "Sangeet"], [0], ["7pm", "Varmala"], ["8pm", "Pheras"], ["10pm onwards", "Reception"]],
    venueName: "Falaknuma Courtyard — Sample Venue", venueAddress: "Jubilee Hills, Hyderabad, Telangana", venueMap: "Jubilee Hills, Hyderabad" },
    { colors: { main: "#1a1712", dark: "#050403", trim: "#d4b46a", ink: "#fff" } }],
  ["rohan-ishita", "Ivory Silk Drape", "A real draped silk curtain — guests drag it open or tap the plaque.", "velvet", {
    groom: "Rohan", bride: "Ishita", date: "2027-02-21T19:00", hashtag: "#RoIshTheKnot", heroPhoto: `${P}couple-moonlit-courtyard.webp`,
    venueName: "The Ivory Courtyard — Sample Venue", venueAddress: "MG Road, Pune, Maharashtra", venueMap: "Pune, Maharashtra" }],
  ["aditya-nisha", "Velvet Stage Curtains", "Crimson velvet stage curtains under a fringed pelmet gather into deep folds at the sides, opening onto a premiere night.", "stagevelvet", {
    groom: "Aditya", bride: "Nisha", date: "2027-12-12T19:00", ...preset("Royal blue"), fontBody: "Cinzel", fontScript: "Pinyon Script",
    hashtag: "#AdiWedsNisha", venueName: "The Sapphire Ballroom — Sample Venue", venueAddress: "Marine Drive, Mumbai, Maharashtra", venueMap: "Marine Drive, Mumbai" }, { colors: { main: "#2f4a8a", dark: "#121f45", trim: "#e2c27a", ink: "#fff6e2" } }],
  ["vivaan-tara", "Sunlit Chiffon", "Peach chiffon blows open in a golden-hour window under fairy lights, a wooden sign swinging on ropes.", "sunlit", {
    groom: "Vivaan", bride: "Tara", date: "2027-04-10T17:30", colorAccent: "#c0603a", colorText: "#5a3a2a", colorBackground: "#fff4ea", colorDetail: "#d08a5a", colorTime: "#8a5a3a", colorButton: "#8a3a2a", dateFormat: "dots-full", closingLayout: "bleed", couplePhoto: `${P}couple-lotus-dawn.webp`,
    venueName: "Banyan Grove Resort — Sample Venue", venueAddress: "Assagao, North Goa", venueMap: "Assagao, Goa", fontNames: "Alex Brush" }, { colors: { main: "#e8b48a", dark: "#6b3a2a", trim: "#e2b25a", ink: "#fff" } }],
  ["samar-riya", "Satin & Pearls", "Blush satin drapes slide apart under swags of pearls, petals falling, onto a pearl-and-blush page.", "satin", {
    groom: "Samar", bride: "Riya", date: "2027-02-06T18:30", ...preset("Rose blush"), closingLayout: "bleed", couplePhoto: `${P}couple-orchid-evening.webp`,
    fontBodyStyle: "italic", venueName: "Petal & Pearl Lawns — Sample Venue", venueAddress: "Chhatarpur, New Delhi", venueMap: "Chhatarpur, New Delhi" }, { colors: { main: "#d99aa5", dark: "#a8616f", trim: "#c9a052", ink: "#5a2433" } }],
  ["dev-kavya", "Marigold Mandap", "Golden mandap pillars and strings of genda phool that sway apart from the middle.", "mandap", {
    groom: "Dev", bride: "Kavya", date: "2027-01-30T19:00", ...preset("Maroon"), hashtag: "#DevKaKavya",
    venueName: "The Grand Rangmahal — Sample Venue", venueAddress: "Ashram Road, Ahmedabad, Gujarat", venueMap: "Ahmedabad, Gujarat" },
    { colors: { main: "#8a1f2c", dark: "#3a0d16", trim: "#f59e0b", ink: "#fff6e2" } }],
  ["yash-sneha", "Lace & Cameo", "White lace panels over plum velvet are drawn aside around an oval cameo.", "lace", {
    groom: "Yash", bride: "Sneha", date: "2027-05-15T18:00", ...preset("Lavender"), fontNames: "Allura", dateFormat: "us",
    venueName: "Lilac Hills Retreat — Sample Venue", venueAddress: "Lonavala, Maharashtra", venueMap: "Lonavala, Maharashtra" },
    { colors: { main: "#6b3f8c", dark: "#2a173d", trim: "#d9b45a", ink: "#fff6e2" } }],
  ["neil-zara", "Beach Cabana", "White linen billows in the sea breeze, then blows open onto Goan blue tiles for a beach wedding.", "cabana", {
    groom: "Neil", bride: "Zara", date: "2027-03-20T17:00", blessing: "", welcomeTitle: "Sand, Sea\nand Forever",
    colorAccent: "#1f7a7a", colorText: "#3c4f52", colorBackground: "#f1f7f4", colorDetail: "#6e9a96", colorTime: "#4d7471", colorButton: "#145a5c",
    program: [[0], ["4pm", "Welcome Drinks"], ["5pm", "Beach Ceremony"], ["7pm onwards", "Dinner & Dancing"]],
    dressTitle: "Theme", dress: "Beach formal — whites, pastels and comfortable sandals.", heroPhoto: `${P}couple-pearl-tide.webp`,
    venueName: "Coral Bay Beach Club — Sample Venue", venueAddress: "Kovalam, Kerala", venueMap: "Kovalam, Kerala" },
    { colors: { main: "#1f4f9a", dark: "#0b2550", trim: "#f2e3c0", ink: "#fff" } }],
  ["aryan-diya", "Fairy-Light Curtain, Reception", "A curtain of warm fairy lights parts around glowing neon names for a reception night.", "lights", {
    groom: "Aryan", bride: "Diya", date: "2027-12-04T20:00", hashtag: "#AryanDiyaReception", welcomeTitle: "Join Us\nFor a Night\nOf Celebration",
    program: [[0], ["8pm", "Couple Entry"], ["8:30pm", "Toasts & First Dance"], ["9pm onwards", "Dinner & DJ"]],
    dressTitle: "Dress Code", dress: "Black tie / Indo-western glam.", fontBody: "Marcellus",
    venueName: "The Gilded Hall — Sample Venue", venueAddress: "Banjara Hills, Hyderabad, Telangana", venueMap: "Banjara Hills, Hyderabad" },
    { colors: { main: "#1b2a52", dark: "#070d1c", trim: "#d8b35d", ink: "#fff" } }],
  ["siddharth-pooja", "Carved Teak Doors", "Carved teak doors with brass studs and ring knockers, oil lamps lit on either side, swing open onto a kasavu-gold page.", "teakdoor", {
    groom: "Siddharth", bride: "Pooja", date: "2027-02-27T18:30", ...preset("Sage"), heroPhoto: `${P}couple-tamil-jasmine.webp`,
    program: [[0], ["6am", "Muhurtham"], ["11am", "Wedding Lunch"], ["7pm onwards", "Reception"]],
    venueName: "Jasmine Mandapam — Sample Venue", venueAddress: "ECR, Chennai, Tamil Nadu", venueMap: "Chennai, Tamil Nadu", dressTitle: "Dress Code", dress: "Traditional silks — pastel and gold." }, { colors: { main: "#6b3a1e", dark: "#2e170a", trim: "#d9a441", ink: "#fff6e2" } }],
  ["veer-meera-sheesh-mahal", "Sheesh Mahal Palace Doors", "A moonlit Rajput palace, glowing lanterns and ornate doors that swing open to reveal your invitation.", "sheeshmahal", {
    groom: "Veer", bride: "Meera", date: "2027-11-26T19:00", dateFormat: "long", ...preset("Maroon"),
    heroPhoto: `${P}couple-orchid-evening.webp`, hashtag: "#VeerMeeraForever",
    venueName: "Sheesh Mahal — Sample Venue", venueAddress: "Amer Fort, Jaipur, Rajasthan", venueMap: "Amer Fort, Jaipur" },
    { colors: { main: "#20303a", dark: "#101321", trim: "#d7b56a", ink: "#fff0ca" } }],
  ["ayaan-sara", "Jali Arch, Nikah", "Lattice jali screens slide away inside a Mughal arch.", "jali", {
    groom: "Ayaan", bride: "Sara", date: "2027-01-17T19:00", blessing: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْم", welcomeTitle: "Two Souls\nOne Promise",
    program: [[-1], ["11am", "Manjha"], ["4pm", "Mehndi"], ["8pm onwards", "Sangeet"], [0], ["5pm", "Nikah"], ["8pm onwards", "Walima Dinner"]],
    colorAccent: "#2f6b5a", colorText: "#3f4d47", colorBackground: "#f4f2ea", colorDetail: "#7c9086", colorTime: "#53685f", colorButton: "#234f43",
    venueName: "The Noor Gardens — Sample Venue", venueAddress: "Hazratganj, Lucknow, Uttar Pradesh", venueMap: "Lucknow, Uttar Pradesh" }, { colors: { main: "#2f6b5a", dark: "#16382f", trim: "#c9a052", ink: "#16382f" } }],
  ["raghav-mira", "Haveli Doors, Bengali Wedding", "Red haveli doors studded with white alpona dots swing open onto an alpona page.", "haveli", {
    groom: "Raghav", bride: "Mira", date: "2027-02-10T19:30", ...preset("Maroon"), blessing: "॥ শুভ বিবাহ ॥", fontNames: "Great Vibes",
    program: [[0], ["8am", "Gaye Holud"], ["6pm", "Bor Jatri"], ["7:30pm", "Biye"], [2], ["8pm onwards", "Bou Bhaat"]],
    venueName: "Rajbari Courtyard — Sample Venue", venueAddress: "Ballygunge, Kolkata, West Bengal", venueMap: "Ballygunge, Kolkata" }, { colors: { main: "#9b1c22", dark: "#4a0b0f", trim: "#e2b65a", ink: "#fff6e2" } }],
  ["manav-tanvi", "Monogram Doors", "Navy doors with a gold monogram seal.", "monogram", {
    groom: "Manav", bride: "Tanvi", date: "2027-03-13T18:00", ...preset("Royal blue"), dateFormat: "slash", hashtag: "#ManTanForever",
    venueName: "Indigo Lake Resort — Sample Venue", venueAddress: "Bhopal, Madhya Pradesh", venueMap: "Bhopal, Madhya Pradesh" },
    { doors: { "--inv-deep": "#1b2a52", "--inv-accent": "#b8862e", "--inv-accent-bright": "#e6c77e" } }],
  ["jay-prisha", "Garden Doors, Gujarati Wedding", "Embossed sage garden doors swing open in 3D onto a watercolour garden page.", "sage", {
    groom: "Jay", bride: "Prisha", date: "2027-01-23T18:00", fontBody: "Italiana",
    program: [[-1], ["10am", "Ganesh Sthapana"], ["4pm", "Mehndi"], ["8pm onwards", "Garba & Dandiya"], [0], ["4pm", "Jaan Aagman"], ["6pm", "Hast Melap"], ["8:30pm", "Dinner"]],
    ...preset("Sage"), venueName: "Kesar Party Plot — Sample Venue", venueAddress: "Vesu, Surat, Gujarat", venueMap: "Surat, Gujarat" }],
  ["aarya-kabir-blush", "Blush Bloom Invitation Doors", "Embossed blush panels part from a wax seal to reveal a floral invitation, inspired by the recorded door-opening reference.", "flowerdoor", {
    groom: "Kabir", bride: "Aarya", date: "2027-12-18T16:00", dateFormat: "long", fontNames: "Parisienne", fontBody: "Cormorant Garamond",
    ...preset("Rose blush"), heroPhoto: `${P}couple-orchid-evening.webp`, hashtag: "#AaryaAndKabir",
    venueName: "The Rose Courtyard — Sample Venue", venueAddress: "Jaipur, Rajasthan", venueMap: "Jaipur, Rajasthan" },
    { colors: { main: "#f4e9eb", dark: "#cbb5ac", trim: "#c58d86", ink: "#593540" } }],
  ["daniel-anika", "Chapel Glass Doors", "Frosted, gold-leaded chapel doors slide apart for a church wedding.", "glass", {
    groom: "Daniel", bride: "Anika", date: "2027-04-24T16:00", blessing: "", welcomeTitle: "Love Is Patient\nLove Is Kind",
    program: [[0], ["4pm", "Holy Matrimony"], ["6pm", "Cocktails"], ["7:30pm onwards", "Reception Dinner"]],
    ...preset("Rose blush"), dateFormat: "us", dressTitle: "Dress Code", dress: "Semi-formal — soft pastels welcome.",
    venueName: "St. Clement's Chapel — Sample Venue", venueAddress: "Bandra West, Mumbai, Maharashtra", venueMap: "Bandra West, Mumbai" },
    { colors: { main: "#c97b8e", dark: "#5a2433", trim: "#c9a052", ink: "#5a2433" } }],
  ["omkar-gauri", "No Intro, Auto Scroll", "Opens straight on the page and glides through each section — great on a big screen.", "none", {
    groom: "Omkar", bride: "Gauri", date: "2027-05-08T12:30", autoScroll: "on", fontScript: "Allura", fontBody: "Cormorant Garamond",
    program: [[0], ["9am", "Halad"], ["12:30pm", "Shubh Vivah"], ["1:30pm", "Bhojan"]],
    venueName: "Shivneri Gardens — Sample Venue", venueAddress: "Kothrud, Pune, Maharashtra", venueMap: "Kothrud, Pune", heroPhoto: `${P}couple-rajasthani-gulabi.webp` }],
];

/** "2027-02-14T19:30" + -1 → "Saturday, 13th Feb" */
function dayLabel(date, offset) {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const when = new Date(Date.UTC(y, m - 1, d + offset));
  const n = when.getUTCDate(), th = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  const part = (o) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(when);
  return `${part({ weekday: "long" })}, ${n}${th} ${part({ month: "short" })}`;
}

// A schedule row is [time, event, location?]; a row with one number is a day heading, as days from the wedding date.
export const SHOWCASE_SITES = RAW.map(([slug, title, blurb, style, { program = hinduDays, ...form }, extra = {}]) => ({
  slug, title, blurb, style, group: STYLES[style][0], page: PAGE_OF[slug] ?? "garden", ...extra,
  // venue picture: the royal sample everywhere, so every page has one
  form: { ...sampleDefaults, hashtag: "", rsvpDeadline: "", venueImage: "/wedding-demo-royal.webp", blessing, ...form,
    program: program.map((row) => (row.length === 1 ? dayLabel(form.date, row[0]) : row.join(" | "))).join("\n"),
    // the K & A film (its letters are part of the film) only for "film"; "seal" paints its own letters on the plain film
    envelopeFilm: style === "film" ? sampleDefaults.envelopeFilm : "" },
}));

export const showcaseSite = (slug) => SHOWCASE_SITES.find((s) => s.slug === slug);

/** The site's Sacred Garden content. */
export const buildShowcase = (site) => buildInvitation(site.form);
