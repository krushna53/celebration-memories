// 20 sample wedding websites for /wedding/webpages — the Sacred Garden design with fictional couples,
// each showing a different opening (envelopes, curtains, doors…), colour theme, fonts and closing.
// Every name, venue and family here is made up; nothing is tied to a real client or event.
import { sampleDefaults, colorFields, buildInvitation } from "@/features/sacred-garden/lib/invitation-form";
import { COLOR_PRESETS, CLOSING_REEL } from "@/features/sacred-garden/lib/sacred-garden";

const preset = (name) => colorFields(COLOR_PRESETS.find(([label]) => label.startsWith(name))[1]);
const P = "/art/couples/";

/** Opening styles: [group, what guests see]. */
export const STYLES = {
  film: ["envelope", "Wax-seal envelope film"],
  seal: ["envelope", "Envelope with the couple's initials on the seal"],
  velvet: ["curtain", "Silk drape you drag or tap open"],
  rise: ["curtain", "Theatre curtain that rises"],
  sheer: ["curtain", "Layered chiffon with fairy lights"],
  swag: ["curtain", "Drapes that gather into the corners"],
  double: ["curtain", "Velvet, then lace"],
  marigold: ["curtain", "Marigold strings that part"],
  pearls: ["curtain", "Pearl strings that part"],
  petals: ["curtain", "Stage curtains with a burst of petals"],
  temple: ["doors", "Temple doors with bells and a toran"],
  jali: ["doors", "Jali screens in a Mughal arch"],
  haveli: ["doors", "Arched haveli doors with brass studs"],
  glass: ["doors", "Frosted chapel doors"],
  sage: ["doors", "Embossed garden doors"],
  monogram: ["doors", "Doors with a monogram seal"],
  none: ["none", "Straight to the page"],
};

// envelope seal colours: the film's red seal turned (hue in degrees) to another wax colour
export const SEAL_TINTS = { red: 0, emerald: 140, sapphire: 220, plum: 290 };

// curtain fabrics for "velvet": [valley, crest] RGB for the cloth and its gathered folds
const FABRIC = {
  maroon: { base: [[70, 10, 22], [150, 36, 52]], deep: [[40, 4, 12], [176, 58, 72]], dark: true },
};

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
  ["rehan-simran", "Mint Envelope, Emerald Seal", "R & S on an emerald wax seal over mint paper, and a wedding film at the end instead of a photo.", "seal", {
    groom: "Rehan", bride: "Simran", date: "2027-03-06T18:00", dateFormat: "long", closingVideo: CLOSING_REEL, ...preset("Sage"),
    venueName: "Rosewater Gardens — Sample Venue", venueAddress: "Sarjapur Road, Bengaluru, Karnataka", venueMap: "Bengaluru, Karnataka",
    fontNames: "Parisienne", fontBody: "Cormorant Garamond" }, { tint: "emerald" }],
  ["vihaan-ira", "Sapphire Seal, Auto-Play", "V & I on a sapphire seal over pale lilac paper; the envelope opens by itself and the page glides through every section.", "seal", {
    groom: "Vihaan", bride: "Ira", date: "2027-01-24T11:00", autoOpen: "2", autoScroll: "on", ...preset("Royal blue"), dateFormat: "day",
    hashtag: "#VihaanKiIra", venueName: "Haveli Sundaram — Sample Venue", venueAddress: "Civil Lines, Jaipur, Rajasthan", venueMap: "Jaipur, Rajasthan" }, { tint: "sapphire" }],

  ["rohan-ishita", "Ivory Silk Drape", "A real draped silk curtain — guests drag it open or tap the plaque.", "velvet", {
    groom: "Rohan", bride: "Ishita", date: "2027-02-21T19:00", hashtag: "#RoIshTheKnot", heroPhoto: `${P}couple-moonlit-courtyard.webp`,
    venueName: "The Ivory Courtyard — Sample Venue", venueAddress: "MG Road, Pune, Maharashtra", venueMap: "Pune, Maharashtra" }],
  ["arjun-meher", "Maroon Velvet Drape", "Deep maroon velvet with pearl trim, tied back with gold tassels.", "velvet", {
    groom: "Arjun", bride: "Meher", date: "2027-11-27T20:00", ...preset("Maroon"), fontScript: "Great Vibes", fontBody: "Playfair Display",
    blessing: "ੴ ਸਤਿ ਨਾਮੁ", program: [[-1], ["11am", "Akhand Path & Kirtan"], ["3pm", "Mehendi"], ["7pm onwards", "Sangeet & Cocktails"], [0], ["9am", "Anand Karaj"], ["1pm", "Lunch"], ["8pm onwards", "Reception"]],
    venueName: "Golden Fields Estate — Sample Venue", venueAddress: "GT Road, Amritsar, Punjab", venueMap: "Amritsar, Punjab" }, { fabric: FABRIC.maroon }],
  ["vivaan-tara", "Chiffon & Fairy Lights", "Layers of sage chiffon drift apart under twinkling lights.", "sheer", {
    groom: "Vivaan", bride: "Tara", date: "2027-04-10T17:30", ...preset("Sage"), dateFormat: "dots-full", closingLayout: "bleed", couplePhoto: `${P}couple-lotus-dawn.webp`,
    venueName: "Banyan Grove Resort — Sample Venue", venueAddress: "Assagao, North Goa", venueMap: "Assagao, Goa", fontNames: "Alex Brush" }, { colors: { main: "#6f7f4f", dark: "#3f4a2c", trim: "#c9a052", ink: "#fff" } }],
  ["aditya-nisha", "Rising Theatre Curtain", "A royal blue stage curtain with gold fringe lifts under the footlights.", "rise", {
    groom: "Aditya", bride: "Nisha", date: "2027-12-12T19:00", ...preset("Royal blue"), fontBody: "Cinzel", fontScript: "Pinyon Script",
    hashtag: "#AdiWedsNisha", venueName: "The Sapphire Ballroom — Sample Venue", venueAddress: "Marine Drive, Mumbai, Maharashtra", venueMap: "Marine Drive, Mumbai" }, { colors: { main: "#2f4a8a", dark: "#121f45", trim: "#e2c27a", ink: "#fff6e2" } }],
  ["samar-riya", "Blush Swag Drapes", "Blush drapes sweep up into the corners under a rosette pelmet.", "swag", {
    groom: "Samar", bride: "Riya", date: "2027-02-06T18:30", ...preset("Rose blush"), closingLayout: "bleed", couplePhoto: `${P}couple-orchid-evening.webp`,
    fontBodyStyle: "italic", venueName: "Petal & Pearl Lawns — Sample Venue", venueAddress: "Chhatarpur, New Delhi", venueMap: "Chhatarpur, New Delhi" }, { colors: { main: "#d99aa5", dark: "#a8616f", trim: "#c9a052", ink: "#5a2433" } }],

  ["dev-kavya", "Marigold Strings", "Strings of genda phool part from the middle like a mandap entrance.", "marigold", {
    groom: "Dev", bride: "Kavya", date: "2027-01-30T19:00", ...preset("Maroon"), hashtag: "#DevKaKavya",
    venueName: "The Grand Rangmahal — Sample Venue", venueAddress: "Ashram Road, Ahmedabad, Gujarat", venueMap: "Ahmedabad, Gujarat" },
    { colors: { main: "#8a1f2c", dark: "#3a0d16", trim: "#f59e0b", ink: "#fff6e2" } }],
  ["yash-sneha", "Velvet & Lace", "Plum velvet opens first, then a lace curtain behind it.", "double", {
    groom: "Yash", bride: "Sneha", date: "2027-05-15T18:00", ...preset("Lavender"), fontNames: "Allura", dateFormat: "us",
    venueName: "Lilac Hills Retreat — Sample Venue", venueAddress: "Lonavala, Maharashtra", venueMap: "Lonavala, Maharashtra" },
    { colors: { main: "#6b3f8c", dark: "#2a173d", trim: "#d9b45a", ink: "#fff6e2" } }],
  ["neil-zara", "Pearl Strings, Beach Wedding", "Strands of pearls and crystal drops part over an ocean-teal backdrop.", "pearls", {
    groom: "Neil", bride: "Zara", date: "2027-03-20T17:00", blessing: "", welcomeTitle: "Sand, Sea\nand Forever",
    colorAccent: "#1f7a7a", colorText: "#3c4f52", colorBackground: "#f1f7f4", colorDetail: "#6e9a96", colorTime: "#4d7471", colorButton: "#145a5c",
    program: [[0], ["4pm", "Welcome Drinks"], ["5pm", "Beach Ceremony"], ["7pm onwards", "Dinner & Dancing"]],
    dressTitle: "Theme", dress: "Beach formal — whites, pastels and comfortable sandals.", heroPhoto: `${P}couple-pearl-tide.webp`,
    venueName: "Coral Bay Beach Club — Sample Venue", venueAddress: "Kovalam, Kerala", venueMap: "Kovalam, Kerala" },
    { colors: { main: "#1f7a7a", dark: "#0b2e30", trim: "#e9d5a8", ink: "#fff" } }],
  ["aryan-diya", "Gold Stage Curtains, Reception", "Gold stage curtains part with a burst of petals for a reception night.", "petals", {
    groom: "Aryan", bride: "Diya", date: "2027-12-04T20:00", hashtag: "#AryanDiyaReception", welcomeTitle: "Join Us\nFor a Night\nOf Celebration",
    program: [[0], ["8pm", "Couple Entry"], ["8:30pm", "Toasts & First Dance"], ["9pm onwards", "Dinner & DJ"]],
    dressTitle: "Dress Code", dress: "Black tie / Indo-western glam.", fontBody: "Marcellus",
    venueName: "The Gilded Hall — Sample Venue", venueAddress: "Banjara Hills, Hyderabad, Telangana", venueMap: "Banjara Hills, Hyderabad" },
    { curtain: { "--inv-curtain": "#b8862e", "--inv-curtain-dark": "#6e4c12", "--inv-deep": "#2b2112", "--inv-accent-bright": "#f5dd9a" } }],

  ["siddharth-pooja", "Temple Doors", "Carved temple doors with brass bells and a mango-leaf toran swing open.", "temple", {
    groom: "Siddharth", bride: "Pooja", date: "2027-02-27T18:30", ...preset("Sage"), heroPhoto: `${P}couple-tamil-jasmine.webp`,
    program: [[0], ["6am", "Muhurtham"], ["11am", "Wedding Lunch"], ["7pm onwards", "Reception"]],
    venueName: "Jasmine Mandapam — Sample Venue", venueAddress: "ECR, Chennai, Tamil Nadu", venueMap: "Chennai, Tamil Nadu", dressTitle: "Dress Code", dress: "Traditional silks — pastel and gold." }, { colors: { main: "#6b3a1e", dark: "#2e170a", trim: "#d9a441", ink: "#fff6e2" } }],
  ["ayaan-sara", "Jali Arch, Nikah", "Lattice jali screens slide away inside a Mughal arch.", "jali", {
    groom: "Ayaan", bride: "Sara", date: "2027-01-17T19:00", blessing: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْم", welcomeTitle: "Two Souls\nOne Promise",
    program: [[-1], ["11am", "Manjha"], ["4pm", "Mehndi"], ["8pm onwards", "Sangeet"], [0], ["5pm", "Nikah"], ["8pm onwards", "Walima Dinner"]],
    colorAccent: "#2f6b5a", colorText: "#3f4d47", colorBackground: "#f4f2ea", colorDetail: "#7c9086", colorTime: "#53685f", colorButton: "#234f43",
    venueName: "The Noor Gardens — Sample Venue", venueAddress: "Hazratganj, Lucknow, Uttar Pradesh", venueMap: "Lucknow, Uttar Pradesh" }, { colors: { main: "#2f6b5a", dark: "#16382f", trim: "#c9a052", ink: "#16382f" } }],
  ["raghav-mira", "Haveli Doors, Bengali Wedding", "Arched red palace doors studded with brass swing open.", "haveli", {
    groom: "Raghav", bride: "Mira", date: "2027-02-10T19:30", ...preset("Maroon"), blessing: "॥ শুভ বিবাহ ॥", fontNames: "Great Vibes",
    program: [[0], ["8am", "Gaye Holud"], ["6pm", "Bor Jatri"], ["7:30pm", "Biye"], [2], ["8pm onwards", "Bou Bhaat"]],
    venueName: "Rajbari Courtyard — Sample Venue", venueAddress: "Ballygunge, Kolkata, West Bengal", venueMap: "Ballygunge, Kolkata" }, { colors: { main: "#9b1c22", dark: "#4a0b0f", trim: "#e2b65a", ink: "#fff6e2" } }],

  ["manav-tanvi", "Monogram Doors", "Navy doors with a gold monogram seal.", "monogram", {
    groom: "Manav", bride: "Tanvi", date: "2027-03-13T18:00", ...preset("Royal blue"), dateFormat: "slash", hashtag: "#ManTanForever",
    venueName: "Indigo Lake Resort — Sample Venue", venueAddress: "Bhopal, Madhya Pradesh", venueMap: "Bhopal, Madhya Pradesh" },
    { doors: { "--inv-deep": "#1b2a52", "--inv-accent": "#b8862e", "--inv-accent-bright": "#e6c77e" } }],
  ["jay-prisha", "Garden Doors, Gujarati Wedding", "Embossed sage doors swing open in 3D onto a Gujarati wedding with Garba night.", "sage", {
    groom: "Jay", bride: "Prisha", date: "2027-01-23T18:00", fontBody: "Italiana",
    program: [[-1], ["10am", "Ganesh Sthapana"], ["4pm", "Mehndi"], ["8pm onwards", "Garba & Dandiya"], [0], ["4pm", "Jaan Aagman"], ["6pm", "Hast Melap"], ["8:30pm", "Dinner"]],
    ...preset("Sage"), venueName: "Kesar Party Plot — Sample Venue", venueAddress: "Vesu, Surat, Gujarat", venueMap: "Surat, Gujarat" }],
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
  ["ishaan-naina", "Minimal, Lavender", "No intro and a calm lavender page with photo closing.", "none", {
    groom: "Ishaan", bride: "Naina", date: "2027-06-19T18:00", ...preset("Lavender"), dateFormat: "long", closingLayout: "bleed",
    couplePhoto: `${P}couple-moonlit-courtyard.webp`, hashtag: "#IshNainaHoGaya",
    venueName: "The Lavender Terrace — Sample Venue", venueAddress: "Shimla, Himachal Pradesh", venueMap: "Shimla, Himachal Pradesh" }],
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
  slug, title, blurb, style, group: STYLES[style][0], ...extra,
  // venue picture: the royal sample everywhere, so every page has one
  form: { ...sampleDefaults, hashtag: "", rsvpDeadline: "", venueImage: "/wedding-demo-royal.webp", blessing, ...form,
    program: program.map((row) => (row.length === 1 ? dayLabel(form.date, row[0]) : row.join(" | "))).join("\n"),
    // the K & A film (its letters are part of the film) only for "film"; "seal" paints its own letters on the plain film
    envelopeFilm: style === "film" ? sampleDefaults.envelopeFilm : "" },
}));

export const showcaseSite = (slug) => SHOWCASE_SITES.find((s) => s.slug === slug);

/** The site's Sacred Garden content. */
export const buildShowcase = (site) => buildInvitation(site.form);
