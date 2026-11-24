// Sample content for the wedding website demo (/wedding-websites/demo).
// Every section reads its props from here, so a real invitation only needs a new object like this.

const venueQuery = "Bel-La Monde, NH8 Delhi";
const mapsUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const demoInvitation = {
  groom: "Kunal",
  bride: "Aanchal",
  monogram: "K & A",
  blessing: "॥ श्री गणेशाय नमः ॥",
  message: "We're getting married",
  date: "2026-11-23T18:30:00+05:30",
  endDate: "2026-11-23T23:30:00+05:30",
  dateLabel: "23 · 11 · 2026",
  place: "Delhi",
  heroImage: "/art/couples/couple-rosewood-vows.webp",

  welcome: {
    message: "With the blessings of our elders and the love of our families, we joyfully invite you to celebrate the beginning of our forever. Your presence will make our day complete.",
    families: [
      { role: "The Groom", name: "Kunal", parents: "Son of Mrs. Kavita & Mr. Rajesh Sharma" },
      { role: "The Bride", name: "Aanchal", parents: "Daughter of Mrs. Anjali & Mr. Vikram Mehta" },
    ],
  },

  events: [
    { name: "Haldi", icon: "flower", date: "21 Nov 2026", time: "10:00 AM", venue: "Poolside Lawns", note: "Wear yellow and come ready to get messy!", mapUrl: mapsUrl(venueQuery) },
    { name: "Mehndi", icon: "leaf", date: "21 Nov 2026", time: "4:00 PM", venue: "Garden Courtyard", note: "An afternoon of henna, music and chai.", mapUrl: mapsUrl(venueQuery) },
    { name: "Sangeet", icon: "dhol", date: "22 Nov 2026", time: "7:30 PM", venue: "Grand Ballroom", note: "Dance the night away with both families.", mapUrl: mapsUrl(venueQuery) },
    { name: "Wedding", icon: "diya", date: "23 Nov 2026", time: "6:30 PM", venue: "Lakeside Mandap", note: "Pheras under the stars by Lake Pichola.", mapUrl: mapsUrl(venueQuery), highlight: true },
    { name: "Reception", icon: "glass", date: "24 Nov 2026", time: "8:00 PM", venue: "Durbar Hall", note: "Dinner, toasts and our first dance.", mapUrl: mapsUrl(venueQuery) },
  ],

  program: [
    { time: "5pm", title: "Sagan Ceremony", day: "Monday, 23rd Nov" },
    { time: "5:30pm", title: "Engagement", location: "Pool Deck" },
    { time: "8:00pm onwards", title: "Cocktail Dinner", location: "Pool Deck" },
    { time: "11am onwards", title: "Haldi Ceremony", location: "Orchid Lawn", day: "Tuesday, 24th Nov" },
    { time: "5pm onwards", title: "Baraat", location: "Carnation Lawn" },
    { time: "7:30pm onwards", title: "Pheras", location: "Carnation Lawn" },
    { time: "9pm onwards", title: "Reception Dinner", location: "Carnation Lawn" },
  ],

  venue: {
    name: "Bel-La Monde",
    address: "NH8, Delhi",
    mapQuery: "Bel-La Monde, NH8 Delhi",
    image: "/wedding-demo-royal.webp",
  },

  gallery: [
    { src: "/art/couples/couple-moonlit-courtyard.webp", alt: "Couple in a moonlit courtyard", caption: "Where it all began" },
    { src: "/art/couples/couple-lotus-dawn.webp", alt: "Couple at dawn by a lotus pond", caption: "Our first sunrise" },
    { src: "/art/couples/couple-rajasthani-gulabi.webp", alt: "Couple in a pink Rajasthani palace", caption: "The proposal" },
    { src: "/art/couples/couple-orchid-evening.webp", alt: "Couple on an orchid-lit evening", caption: "Forever starts now" },
    { src: "/art/couples/couple-pearl-tide.webp", alt: "Couple by the sea", caption: "Two hearts, one home" },
  ],

  menu: {
    veg: ["Dal Baati Churma", "Paneer Lababdar", "Gatte ki Sabzi", "Kesar Jalebi with Rabri"],
  },

  dressCode: {
    women: "Lehengas or sarees in jewel tones — think rani pink, emerald and gold.",
    men: "Sherwanis, bandhgalas or kurta sets with a colourful safa.",
    palette: [
      { name: "Navy", color: "#1e1b4b" },
      { name: "Coral", color: "#ff6b57" },
      { name: "Ivory", color: "#fdf6ec" },
      { name: "Gold", color: "#d4a24c" },
      { name: "Rani", color: "#c2185b" },
    ],
  },

  guestInfo: [
    { icon: "car", title: "Transportation", text: "Shuttles run from Udaipur Airport and the railway station every hour on 21–24 Nov. Share your arrival time in the RSVP.", link: { href: mapsUrl("Maharana Pratap Airport Udaipur"), label: "Airport on the map" } },
    { icon: "bed", title: "Accommodation", text: "Rooms are reserved for our guests at The Leela Palace. Mention ‘Kunal & Aanchal wedding’ when you book." },
    { icon: "gift", title: "Gifts", text: "Your blessings are the greatest gift. If you wish to give something, a contribution to our first home is warmly appreciated." },
  ],

  rsvp: {
    deadline: "Kindly reply by 15 November 2026",
    events: ["Haldi", "Mehndi", "Sangeet", "Wedding", "Reception"],
  },

  closing: {
    message: "Your love, laughter and blessings mean the world to us. We can't wait to celebrate with you.",
    hashtag: "#KunalWedsAanchal",
    image: "/art/couples/couple-tamil-jasmine.webp",
    contacts: [
      { label: "Groom's family", name: "Rajesh Sharma", phone: "+91 98765 43210" },
      { label: "Bride's family", name: "Vikram Mehta", phone: "+91 91234 56789" },
    ],
  },
};

// The public demo (/wedding-websites/demo-garden): a made-up couple and venue, like sampleDefaults in invitation-form.js.
// demoInvitation above stays as it is: live events fill their unsaved fields from it (through formDefaults).
const sampleVenue = "Jaipur, Rajasthan";
export const sampleInvitation = {
  ...demoInvitation,
  groom: "Kabir",
  bride: "Aditi",
  blessing: "॥ श्री कृष्णाय नमः ॥",
  date: "2027-02-13T18:30:00+05:30",
  endDate: "2027-02-13T23:30:00+05:30",
  dateLabel: "13 · 02 · 2027",
  place: "Jaipur",
  welcome: {
    ...demoInvitation.welcome,
    families: [
      { role: "The Groom", name: "Kabir", parents: "Son of Mrs. Meera & Mr. Sanjay Malhotra" },
      { role: "The Bride", name: "Aditi", parents: "Daughter of Mrs. Kavya & Mr. Rohan Desai" },
    ],
  },
  events: [
    { name: "Mehndi", icon: "leaf", date: "12 Feb 2027", time: "4:00 PM", venue: "Garden Courtyard", note: "An afternoon of henna, music and chai.", mapUrl: mapsUrl(sampleVenue) },
    { name: "Sangeet", icon: "dhol", date: "12 Feb 2027", time: "8:00 PM", venue: "Grand Lawn", note: "Dance the night away with both families.", mapUrl: mapsUrl(sampleVenue) },
    { name: "Haldi", icon: "flower", date: "13 Feb 2027", time: "11:00 AM", venue: "Poolside", note: "Wear yellow and come ready to get messy!", mapUrl: mapsUrl(sampleVenue) },
    { name: "Wedding", icon: "diya", date: "13 Feb 2027", time: "6:30 PM", venue: "Rose Mandap", note: "Pheras under the stars in the garden.", mapUrl: mapsUrl(sampleVenue), highlight: true },
    { name: "Reception", icon: "glass", date: "13 Feb 2027", time: "9:00 PM", venue: "Grand Lawn", note: "Dinner, toasts and our first dance.", mapUrl: mapsUrl(sampleVenue) },
  ],
  program: [
    { time: "4pm", title: "Mehndi", location: "Garden Courtyard", day: "Friday, 12th Feb" },
    { time: "8pm onwards", title: "Sangeet", location: "Grand Lawn" },
    { time: "11am onwards", title: "Haldi", location: "Poolside", day: "Saturday, 13th Feb" },
    { time: "5pm onwards", title: "Baraat", location: "Main Gate" },
    { time: "6:30pm onwards", title: "Pheras", location: "Rose Mandap" },
    { time: "9pm onwards", title: "Reception Dinner", location: "Grand Lawn" },
  ],
  venue: { ...demoInvitation.venue, name: "The Rosewood Garden — Sample Venue", address: "Amer Road, Jaipur, Rajasthan", mapQuery: sampleVenue },
  guestInfo: [
    { icon: "car", title: "Transportation", text: "Shuttles run from Jaipur Airport and the railway station every hour on 12–13 Feb. Share your arrival time in the RSVP.", link: { href: mapsUrl("Jaipur International Airport"), label: "Airport on the map" } },
    { icon: "bed", title: "Accommodation", text: "Rooms are reserved for our guests at the venue. Mention ‘Kabir & Aditi wedding’ when you book." },
    demoInvitation.guestInfo.find((item) => item.icon === "gift"),
  ],
  rsvp: { deadline: "Kindly reply by 15 January 2027", events: ["Mehndi", "Sangeet", "Haldi", "Wedding", "Reception"] },
  closing: {
    ...demoInvitation.closing,
    hashtag: "#KabirWedsAditi",
    contacts: [
      { label: "Groom's family", name: "Sanjay Malhotra", phone: "+91 98765 43210" },
      { label: "Bride's family", name: "Rohan Desai", phone: "+91 91234 56789" },
    ],
  },
};
