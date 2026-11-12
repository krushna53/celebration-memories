// Form for /wedding-websites/create. The fields match the Sacred Garden design, and
// buildInvitation() turns them into the garden's content (lib/sacred-garden.js).
import { demoInvitation as demo } from "./demo-invitation";
import { sacredGardenFrom, DEFAULT_WELCOME_TITLE, DEFAULT_MUSIC, DEFAULT_FONTS, FONT_CHOICES, COLOR_PRESETS, DEFAULT_COLORS, DATE_FORMATS, CLOSING_REEL } from "./sacred-garden";

/**
 * [key, label, type?, choices?] — type defaults to a single-line text input.
 * Other types: "textarea", "datetime-local", "image" (upload or link), "audio" (upload, link, design track or none),
 * "video" (upload or link), "select" (choices: [[value, label], …]), "color", "slug" (the published link, with suggestions from the names).
 * A group with `presets` also shows one-click themes that fill its colour fields.
 */
// how the opening video starts: on the guest's tap, or by itself after a moment (seconds)
const AUTO_OPEN = [["", "Wait for the guest's tap"], ["2", "Open by itself after 2 seconds"]];
// after it opens: the guest scrolls, or the page glides through each section until they touch it
const AUTO_SCROLL = [["", "Guests scroll themselves"], ["on", "Scroll gently through the page (stops when the guest touches it)"]];

// how the closing photo is laid out: the design's bouquets, or full width with no flowers
const CLOSING_LAYOUTS = [["", "Framed by flowers (design)"], ["bleed", "Full width, no flowers"]];

export const FORM_GROUPS = [
  { title: "Couple", fields: [["blessing", "God's name / blessing line (e.g. ॥ श्री गणेशाय नमः ॥)"], ["groom", "Groom's name"], ["groomParents", "Line under the groom's name (optional, e.g. S/O Mrs. … and Mr. …)"], ["bride", "Bride's name"], ["brideParents", "Line under the bride's name (optional, e.g. D/O Mrs. … and Mr. …)"], ["date", "Wedding date & time", "datetime-local"], ["dateFormat", "Date style on the cover", "select", DATE_FORMATS],
    ["coverDate", "Date on the cover in your own words (optional, e.g. 23rd–24th Nov 2026)"], ["heroPhoto", "Photo shown faintly behind the names (optional)", "image"]] },
  { title: "Hashtag", hint: "Optional. Shown on the cover, the schedule, under RSVP, at the closing and in WhatsApp invites. Guests tap it to copy.", fields: [["hashtag", "Wedding hashtag (e.g. #AaChalwithKunal)"]] },
  { title: "Website link", hint: "Pick a link made from the names, or type your own. Publish puts your website there.", fields: [["slug", "Link", "slug"]] },
  { title: "Welcome", fields: [["welcomeTitle", "Welcome heading (one line each)", "textarea"], ["welcome", "Welcome message", "textarea"]] },
  { title: "Schedule of events", hint: "One per line: Time | Event | Location (optional) | Note (optional, e.g. Cocktail followed by Dinner). A line with only a day (e.g. Tuesday, 24th Nov) starts that day.", fields: [["program", "Schedule", "textarea"]] },
  { title: "Location", fields: [["venueName", "Venue name"], ["venueAddress", "Address"], ["venueMap", "Map search (optional)"], ["venueImage", "Hotel / venue picture", "image"]] },
  { title: "Dress code & gifts", fields: [["dressTitle", "Heading (e.g. Dress Code / Theme)"], ["dress", "Dress code", "textarea"], ["gifts", "Gift note", "textarea"]] },
  { title: "Closing", hint: "A photo or a video at the bottom of the page — pick one.", closingChoice: true, fields: [
    ["couplePhoto", "Photo (upload to replace the sample)", "image"],
    ["closingVideo", "Video", "video"],
    ["closingLayout", "Photo style", "select", CLOSING_LAYOUTS],
  ] },
  { title: "Fonts", fields: [
    ["fontScript", "Headings font", "select", FONT_CHOICES.script],
    ["fontNames", "Names font", "select", FONT_CHOICES.names],
    ["fontBody", "Text font", "select", FONT_CHOICES.body],
    ["fontBodyStyle", "Text style", "select", FONT_CHOICES.bodyStyle],
  ] },
  { title: "Colours", hint: "Pick a theme, then fine-tune any colour.", presets: COLOR_PRESETS, fields: [
    ["colorAccent", "Headings, names & countdown", "color"],
    ["colorText", "Text", "color"],
    ["colorBackground", "Background", "color"],
    ["colorDetail", "Schedule line & markers", "color"],
    ["colorTime", "Schedule times", "color"],
    ["colorButton", "Buttons (RSVP & music)", "color"],
  ] },
  { title: "Opening video", hint: "What guests see first, before \"Tap to open\". Keep the design's wax-seal envelope, or upload your own (MP4). Add a wide video too for computers; without one they show the phone video.", fields: [
    ["introVideo", "Phone video (upright 9:16)", "video"],
    ["introVideoDesktop", "Computer video (wide 16:9, optional)", "video"],
    ["autoOpen", "Opening", "select", AUTO_OPEN],
    ["autoScroll", "After it opens", "select", AUTO_SCROLL],
  ] },
  { title: "Music", hint: "Plays when the guest opens the envelope.", fields: [["music", "Background music", "audio"]] },
];

/** a colour theme ({ accent, text, … }) as form fields ({ colorAccent, colorText, … }) */
export const colorFields = (k) => ({ colorAccent: k.accent, colorText: k.text, colorBackground: k.background, colorDetail: k.detail, colorTime: k.time, colorButton: k.button });

const lines = (text) => (text || "").split("\n").map((l) => l.split("|").map((p) => p.trim())).filter((r) => r.some(Boolean));

/** Schedule text → items: "Time | Event | Location? | Note?" per line; a line with no "|" is the day heading of the event after it. */
function programItems(text) {
  const items = [];
  let day = "";
  for (const [time = "", title = "", location = "", note = ""] of lines(text)) {
    if (!title && !location && !note) { day = time; continue; }
    items.push({ time, title, ...(location && { location }), ...(note && { note }), ...(day && { day }) });
    day = "";
  }
  return items;
}

export const formDefaults = {
  blessing: demo.blessing,
  groom: "Kunal",
  bride: demo.bride,
  date: "2026-11-23T18:30",
  dateFormat: "dots",
  groomParents: "",
  brideParents: "",
  coverDate: "",
  heroPhoto: "",
  slug: "",
  hashtag: "", // empty for every new couple; the samples carry their own
  welcomeTitle: DEFAULT_WELCOME_TITLE,
  welcome: demo.welcome.message,
  program: demo.program.flatMap((p) => [...(p.day ? [p.day] : []), [p.time, p.title, p.location].filter(Boolean).join(" | ")]).join("\n"),
  venueName: demo.venue.name,
  venueAddress: demo.venue.address,
  venueMap: demo.venue.mapQuery,
  venueImage: "/wedding-demo-royal.webp",
  dressTitle: "Dress Code",
  dress: [demo.dressCode.women, demo.dressCode.men].join(" "),
  gifts: demo.guestInfo.find((item) => item.icon === "gift").text,
  rsvpDeadline: demo.rsvp.deadline, // only the older /wedding/<slug> sites use the design's own RSVP; events use the site's live RSVP
  couplePhoto: "",
  closingVideo: "",
  closingLayout: "",
  // Grok's re-lettered envelope film and the letters it shows; set by the create page.
  // The sample names start with the K & A film we already have, so nothing is made for them.
  envelopeFilm: "/invite-art/sacred/envelope-k-a.mp4",
  envelopeLetters: "K & A",
  // the couple's own opening video, shown instead of the envelope film; empty = the envelope film
  introVideo: "",
  // a wide version for computers; empty = the phone video (or envelope film) there too
  introVideoDesktop: "",
  autoOpen: "",
  autoScroll: "",
  fontScript: DEFAULT_FONTS.script,
  fontNames: DEFAULT_FONTS.names,
  fontBody: DEFAULT_FONTS.body,
  fontBodyStyle: DEFAULT_FONTS.bodyStyle,
  music: DEFAULT_MUSIC,
  ...colorFields(DEFAULT_COLORS),
};

/** "Kunal" → "kunal"; letters outside a–z are dropped (names in other scripts give ""). */
const slugPart = (text) => String(text || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Link choices from the names and year, e.g. kunal-aanchal, kunal-weds-aanchal, aanchal-kunal, kunal-aanchal-2026. */
export function slugOptions(f) {
  const g = slugPart(f.groom), b = slugPart(f.bride), year = (f.date || "").slice(0, 4);
  if (!g && !b) return ["our-wedding", `our-wedding-${year}`].filter((x) => /^[a-z0-9-]{3,}$/.test(x));
  if (!g || !b) return [g || b, `${g || b}-wedding`, `${g || b}-${year}`];
  return [...new Set([`${g}-${b}`, `${g}-weds-${b}`, `${b}-${g}`, `${g}-and-${b}`, `${g}-${b}-${year}`, `${g}${b}`])];
}

/** The published link: what the couple typed, else the first choice. */
export const slugFor = (f) => slugPart(f.slug) || slugOptions(f)[0];

export const SAMPLE_CLOSING_VIDEO = CLOSING_REEL;

// Two ready-made websites from the sample (Kunal & Aanchal), at /wedding/sample-photo and /wedding/sample-video.
// A 16:9 version of an envelope film for computers: the phone film widened to fill the screen, seal kept round.
const WIDE_FILMS = { "/invite-art/sacred/envelope-k-a.mp4": "/invite-art/sacred/envelope-k-a-wide-full.mp4" };

// Their envelope film already carries K & A (made once, the same way the create page makes it).
const sampleSite = { ...formDefaults, hashtag: "#AaChalwithKunal" };
export const SAMPLE_SITES = {
  "sample-photo": sampleSite,
  "sample-video": { ...sampleSite, closingVideo: CLOSING_REEL },
};

/** The design's own track, for the music field's "Use the design's music" button. */
export const DESIGN_MUSIC = DEFAULT_MUSIC;

/** "2027-02-14T18:30" → ISO time in IST, or null when empty / invalid. */
function parseWhen(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** "aa chal with kunal" / "#AaChalwithKunal" → "#AaChalwithKunal"; "" when empty. */
export function cleanHashtag(value) {
  // hashtags can't hold spaces or punctuation, so keep only letters (any script), digits and _
  const tag = String(value || "").replace(/[^\p{L}\p{M}\p{N}_]+/gu, "");
  return tag ? `#${tag}` : "";
}

/** Turns the form into the Sacred Garden content used by <SacredGardenInvitation>. */
export function buildInvitation(f) {
  const groom = f.groom.trim() || "Groom";
  const bride = f.bride.trim() || "Bride";
  const venueName = f.venueName.trim() || "Venue";
  const monogram = `${groom[0]} & ${bride[0]}`.toUpperCase();
  // the couple's own opening video; else Grok's film, only while it still shows these initials (in it the old letters are gone and the new ones are part of the film)
  const film = f.introVideo || (f.envelopeFilm && f.envelopeLetters === monogram ? f.envelopeFilm : "");
  const c = sacredGardenFrom({
    groom, bride, monogram,
    groomParents: f.groomParents?.trim(), brideParents: f.brideParents?.trim(),
    blessing: f.blessing.trim(),
    date: parseWhen(f.date) || demo.date,
    welcome: { title: f.welcomeTitle.trim(), message: f.welcome },
    program: programItems(f.program),
    venue: { name: venueName, address: f.venueAddress.trim(), mapQuery: f.venueMap.trim() },
    dressCode: { title: (f.dressTitle ?? "").trim(), women: f.dress.trim() },
    guestInfo: f.gifts.trim() ? [{ icon: "gift", text: f.gifts.trim() }] : [],
    rsvp: { deadline: f.rsvpDeadline.trim() },
    dateFormat: f.dateFormat,
    coverDate: f.coverDate?.trim(),
    hashtag: cleanHashtag(f.hashtag),
    closingLayout: f.closingLayout,
    envelopeFilm: film || undefined,
    music: f.music.trim(),
    fonts: { script: f.fontScript, names: f.fontNames, body: f.fontBody, bodyStyle: f.fontBodyStyle },
    colors: { accent: f.colorAccent, text: f.colorText, background: f.colorBackground, detail: f.colorDetail, time: f.colorTime, button: f.colorButton },
  }, { venue: f.venueImage || undefined, couple: f.couplePhoto || undefined, closingVideo: f.closingVideo || undefined, hero: f.heroPhoto || undefined });
  // computers: the wide video, else the phone one; phones: the phone video or film, else the wide one
  const desktopVideo = f.introVideoDesktop || WIDE_FILMS[film] || film;
  const video = film || desktopVideo;
  // never letters drawn over a film by code: the envelope is shown only once Grok's film (or the couple's own video) is ready
  return { ...c, envelope: { ...c.envelope, ...(video ? { video, desktopVideo } : {}), ready: Boolean(video), autoOpen: Number(f.autoOpen) || 0 }, autoScroll: f.autoScroll === "on" };
}
