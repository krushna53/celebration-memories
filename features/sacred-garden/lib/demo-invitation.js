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
    { time: "5:30pm", title: "Engagement" },
    { time: "8:00pm onwards", title: "Cocktail Dinner" },
    { time: "11am onwards", title: "Haldi Ceremony", day: "Tuesday, 24th Nov" },
    { time: "5pm onwards", title: "Baraat" },
    { time: "7:30pm onwards", title: "Pheras" },
    { time: "9pm onwards", title: "Reception Dinner" },
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
