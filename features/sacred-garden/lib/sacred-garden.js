// Content of "The Sacred Garden" invitation. sacredGardenFrom() turns any invitation in the shape of
// lib/demo-invitation.js (the demo, or the create form) into the garden's content.
// Films and pictures are served from /public/invite-art/sacred.
import { demoInvitation } from "./demo-invitation";

export const DEFAULT_WELCOME_TITLE = "Two Hearts\nOne Journey\nA Lifetime Together";
export const ENVELOPE_VIDEO = "/invite-art/sacred/envelope-light-burst.mp4";
export const CLOSING_REEL = "/invite-art/sacred/closing-reel.mp4"; // default sample video at the bottom of the page
export const DEFAULT_MUSIC ="https://pub-4dc8201144ca418fb604349c73e8c724.r2.dev/Einaudi_%20Divenire%20(1)%20(1).mp3";

// Fonts a couple can pick. The first of each list is the design's own (files in /public/fonts/sacred);
// the others are loaded for the whole site in app/layout.jsx.
const SCRIPTS = [["Great Vibes", "Great Vibes"], ["Pinyon Script", "Pinyon Script"], ["Parisienne", "Parisienne"], ["Alex Brush", "Alex Brush"], ["Allura", "Allura"]];
export const FONT_CHOICES = {
  script: [["SG Imperial Script", "Imperial Script (design)"], ...SCRIPTS],
  names: [["SG Beau Rivage", "Beau Rivage (design)"], ["SG Imperial Script", "Imperial Script"], ...SCRIPTS],
  body: [["SG GT Super Display", "GT Super Display (design)"], ["Cormorant Garamond", "Cormorant Garamond"], ["Playfair Display", "Playfair Display"], ["Marcellus", "Marcellus"], ["Italiana", "Italiana"], ["Cinzel", "Cinzel"]],
  bodyStyle: [["normal", "Regular"], ["italic", "Italic"]],
};
export const DEFAULT_FONTS = { script: "SG Imperial Script", names: "SG Beau Rivage", body: "SG GT Super Display", bodyStyle: "normal" };

// Colours: accent (headings, names, countdown), text, background, detail (schedule line and markers),
// time (schedule times) and button (RSVP and music buttons). The first theme is the design's own.
export const COLOR_PRESETS = [
  ["Classic gold (design)", { accent: "#a67d2b", text: "#6c513f", background: "#f9f0e0", detail: "#8c7666", time: "#846f61", button: "#5a0f1b" }],
  ["Rose blush", { accent: "#b0596e", text: "#6b4a50", background: "#fbf0ee", detail: "#a07882", time: "#8e6670", button: "#8c2f45" }],
  ["Sage garden", { accent: "#6f7f4f", text: "#4f5a44", background: "#f3f2e7", detail: "#7c8a6a", time: "#66735a", button: "#4e5d36" }],
  ["Royal blue", { accent: "#2f4a8a", text: "#39415a", background: "#f1f3f8", detail: "#6d7896", time: "#4d5878", button: "#1f3166" }],
  ["Maroon & gold", { accent: "#8a1f2c", text: "#5a3a32", background: "#fbf3e8", detail: "#a07a5c", time: "#7a4a3a", button: "#5a0f1b" }],
  ["Lavender", { accent: "#7a5c9e", text: "#4f4560", background: "#f6f2fa", detail: "#9384a8", time: "#6e6182", button: "#4b3570" }],
];
export const DEFAULT_COLORS = COLOR_PRESETS[0][1];

// How the cover shows the date: [value, label]. Labels use 23 November 2026 as the example.
export const DATE_FORMATS = [
  ["dots", "23.11.26"], ["dots-full", "23 · 11 · 2026"], ["slash", "23/11/2026"],
  ["long", "23 November 2026"], ["us", "November 23, 2026"], ["day", "Monday, 23 November 2026"],
];
const DATE_PARTS = {
  dots: [{ day: "2-digit", month: "2-digit", year: "2-digit" }, "."],
  "dots-full": [{ day: "2-digit", month: "2-digit", year: "numeric" }, " · "],
  slash: [{ day: "2-digit", month: "2-digit", year: "numeric" }, "/"],
};
const DATE_WORDS = { long: { day: "numeric", month: "long", year: "numeric" }, us: { day: "numeric", month: "long", year: "numeric" }, day: { weekday: "long", day: "numeric", month: "long", year: "numeric" } };

/** Keep the calendar date fixed while rendering it in the chosen style and the guest's locale. */
const formatDate = (iso = "", lang = "en", style = "dots") => {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const when = new Date(Date.UTC(year, month - 1, day));
  const locale = lang === "en" ? (style === "us" ? "en-US" : "en-GB") : lang;
  try {
    if (DATE_WORDS[style]) return new Intl.DateTimeFormat(locale, { ...DATE_WORDS[style], calendar: "gregory", timeZone: "UTC" }).format(when);
    const [parts, joiner] = DATE_PARTS[style] || DATE_PARTS.dots;
    return new Intl.DateTimeFormat(locale, { ...parts, calendar: "gregory", timeZone: "UTC" }).formatToParts(when)
      .filter((part) => ["day", "month", "year"].includes(part.type)).map((part) => part.value).join(joiner);
  } catch {
    return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${String(year).slice(-2)}`;
  }
};

/**
 * d: invitation object (groom, bride, monogram?, blessing, date, welcome { title?, message }, program, venue, dressCode, guestInfo, rsvp,
 *    groomParents? / brideParents? (a line under each name on the cover, e.g. "S/O Mrs. … and Mr. …"),
 *    hashtag? (e.g. "#AaChalwithKunal": cover, schedule, under RSVP, closing; "" = none),
 *    dateFormat? (a DATE_FORMATS value), coverDate? (the cover's date in the couple's own words, e.g. "23rd–24th Nov 2026"; wins over dateFormat), envelopeFilm? (Grok's re-lettered envelope film), sealImage? (Grok's re-lettered seal close-up, laid over our film's seal), music? (URL, "" for none), fonts? { script, names, body, bodyStyle }, colors? { accent, text, background, detail, time, button }).
 * photos: optional { venue, couple } pictures that replace the design's own, closingVideo (shown instead of the couple photo)
 *   and hero (a photo shown faintly behind the names).
 * d.closingLayout: "bleed" = the closing photo full width with no bouquets (see SgClosing); empty = the design's bouquets.
 */
export function sacredGardenFrom(d, photos = {}, lang = "en") {
  const mapQuery = d.venue.mapQuery || [d.venue.name, d.venue.address].filter(Boolean).join(", ");
  return {
    couple: { first: d.groom, second: d.bride, joined: `${d.groom} and ${d.bride}`, firstParents: d.groomParents, secondParents: d.brideParents },
    monogram: d.monogram || `${d.groom[0]} & ${d.bride[0]}`,
    hashtag: d.hashtag || "",

    envelope: {
      // Grok's re-lettered film when there is one; else our own film as it is. No letters are drawn over a film by code.
      video: d.envelopeFilm || ENVELOPE_VIDEO,
      sealImage: d.sealImage,
      tapLabel: "Tap to open",
    },
    music: d.music ?? DEFAULT_MUSIC,
    fonts: { ...DEFAULT_FONTS, ...d.fonts },
    colors: { ...DEFAULT_COLORS, ...d.colors },

    hero: {
      // H.264 with its index up front, so every phone plays it and it starts before it has fully downloaded
      video: "/invite-art/sacred/hero-swans.mp4",
      poster: "/invite-art/sacred/hero-swans-poster.webp",
      weddingDay: "Wedding Day",
      date: d.coverDate || formatDate(d.date, lang, d.dateFormat),
      photo: photos.hero,
      scrollLabel: "Scroll down",
    },
    welcome: {
      blessing: d.blessing,
      title: d.welcome.title ?? DEFAULT_WELCOME_TITLE,
      message: d.welcome.message,
    },

    countdown: { title: "The Celebration Begins In", date: d.date, labels: ["Days", "Hours", "Minutes", "Seconds"] },

    schedule: {
      title: "Schedule of Events",
      items: d.program.map(({ time, title, location, day, labelShift }) => ({ time, title, location, day, labelShift })),
    },

    location: {
      title: "Location",
      name: d.venue.name,
      address: d.venue.address || "",
      mapEmbed: `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`,
      directions: mapQuery ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}` : "",
      image: photos.venue,
    },

    dressCode: { title: d.dressCode.title || "Dress Code", text: [d.dressCode.women, d.dressCode.men].filter(Boolean).join(" ") },
    gifts: { title: "Gift Preference", text: d.guestInfo.find((item) => item.icon === "gift")?.text },

    rsvp: {
      title: "Confirm Your Attendance",
      text: "To help us prepare for a joyful celebration, kindly confirm your attendance.",
      openLabel: "Click to open",
      note: d.rsvp.deadline,
      // Replies are POSTed here as a form; empty means this demo only shows the thank-you.
      endpoint: "",
      fields: [
        { name: "Your name", type: "text", required: true },
        { name: "Will you be attending?", type: "radio", options: ["Accepts with pleasure", "Declines with regret"], required: true },
        { name: "Number of Guests Attending", type: "text", required: true },
        { name: "A Song That Gets You Dancing", type: "text" },
        { name: "Children Attending", hint: "Please include names and ages.", type: "text", required: true },
      ],
      submit: "Submit",
      required: "Required field",
      success: d.hashtag ? `Thank you! Your RSVP has been received. Share every moment with ${d.hashtag}` : "Thank you! Your RSVP has been received.",
      failure: "Sorry, your RSVP could not be sent. Please try again.",
    },

    closing: { title: "Hope to see you there!", photo: photos.couple, video: photos.closingVideo, layout: d.closingLayout },
  };
}

export function sacredGardenFor(lang) {
  return sacredGardenFrom(demoInvitation, {}, lang);
}

export const sacredGarden = sacredGardenFrom(demoInvitation);
