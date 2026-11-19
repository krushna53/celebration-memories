// Sample wedding invitation cards for /wedding/card — each one drawn in CSS (cards.module.css, by `style`).
// Fictional couples and sample venues; clicking a card opens the template store to personalise it.
export { TEMPLATE_STORE_URL } from "../reels/reel-templates";

export const CARD_TAGS = ["All", "Traditional", "Floral", "Modern", "Minimal", "Regional"];

/** { slug, title, tag, style, kicker, couple: [a, b], date, venue, note? } */
export const CARDS = [
  { slug: "royal-maroon", title: "Royal Maroon", tag: "Traditional", style: "royal", kicker: "॥ श्री गणेशाय नमः ॥", couple: ["Karan", "Ananya"], date: "Sunday, 14 February 2027", venue: "The Marigold Palace, Udaipur", note: "Gold-foil frame with carved corners" },
  { slug: "watercolour-blooms", title: "Watercolour Blooms", tag: "Floral", style: "watercolor", kicker: "Together with their families", couple: ["Rohan", "Ishita"], date: "21 · 02 · 2027", venue: "The Ivory Courtyard, Pune", note: "Soft painted peonies and blush washes" },
  { slug: "quiet-minimal", title: "Quiet Minimal", tag: "Minimal", style: "minimal", kicker: "The wedding of", couple: ["Ishaan", "Naina"], date: "19.06.27", venue: "The Lavender Terrace, Shimla", note: "Just type, space and one fine line" },
  { slug: "art-deco-night", title: "Art Deco Night", tag: "Modern", style: "deco", kicker: "You are cordially invited", couple: ["Aditya", "Nisha"], date: "12 December 2027", venue: "The Sapphire Ballroom, Mumbai", note: "Navy and gold sunburst, 1920s glamour" },
  { slug: "boho-sunset", title: "Boho Sunset", tag: "Modern", style: "boho", kicker: "Join us as we say I do", couple: ["Vivaan", "Tara"], date: "10 April 2027", venue: "Banyan Grove Resort, Goa", note: "Terracotta arches and a setting sun" },
  { slug: "kolam-kalyanam", title: "Kolam Kalyanam", tag: "Regional", style: "kolam", kicker: "Subha Muhurtham", couple: ["Siddharth", "Pooja"], date: "27 February 2027 · 6am", venue: "Jasmine Mandapam, Chennai", note: "Rice-flour kolam dots around the names" },
  { slug: "marigold-mandap", title: "Marigold Mandap", tag: "Traditional", style: "marigold", kicker: "Shubh Vivah", couple: ["Dev", "Kavya"], date: "30 January 2027", venue: "The Grand Rangmahal, Ahmedabad", note: "Genda phool strings across the top" },
  { slug: "lotus-pond", title: "Lotus Pond", tag: "Floral", style: "lotus", kicker: "With joy, we invite you", couple: ["Jay", "Prisha"], date: "23 January 2027", venue: "Kesar Party Plot, Surat", note: "Teal water and blooming lotuses" },
  { slug: "chantilly-lace", title: "Chantilly Lace", tag: "Floral", style: "lace", kicker: "Love is patient, love is kind", couple: ["Daniel", "Anika"], date: "April 24, 2027", venue: "St. Clement's Chapel, Mumbai", note: "Scalloped lace edge on blush card" },
  { slug: "emerald-nikah", title: "Emerald Nikah", tag: "Regional", style: "emerald", kicker: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْم", couple: ["Ayaan", "Sara"], date: "17 January 2027", venue: "The Noor Gardens, Lucknow", note: "Eight-point star pattern in gold" },
  { slug: "photo-story", title: "Photo Story", tag: "Modern", style: "snapshot", kicker: "Save the date", couple: ["Samar", "Riya"], date: "06 · 02 · 27", venue: "Petal & Pearl Lawns, New Delhi", note: "Your favourite photo, edge to edge" },
  { slug: "kraft-twine", title: "Kraft & Twine", tag: "Minimal", style: "kraft", kicker: "We're tying the knot", couple: ["Rehan", "Simran"], date: "6 March 2027", venue: "Rosewater Gardens, Bengaluru", note: "Recycled-paper look with a twine bow" },
  { slug: "starlit-vows", title: "Starlit Vows", tag: "Modern", style: "night", kicker: "Written in the stars", couple: ["Vihaan", "Ira"], date: "24 January 2027", venue: "Haveli Sundaram, Jaipur", note: "Midnight blue, crescent moon, gold stars" },
  { slug: "azulejo-tiles", title: "Azulejo Tiles", tag: "Regional", style: "tiles", kicker: "Sand, sea & forever", couple: ["Neil", "Zara"], date: "20 March 2027", venue: "Coral Bay Beach Club, Kovalam", note: "Goan blue-tile border" },
  { slug: "pink-city-palace", title: "Pink City Palace", tag: "Traditional", style: "palace", kicker: "Padharo Mhare Des", couple: ["Arjun", "Meher"], date: "27 November 2027", venue: "Gulabi Bagh, Jaipur", note: "Rose-pink palace domes at dawn" },
  { slug: "holo-glass", title: "Holo Glass", tag: "Modern", style: "holo", kicker: "It's official", couple: ["Omkar", "Gauri"], date: "08.05.2027", venue: "Shivneri Gardens, Pune", note: "Shifting gradient behind frosted glass" },
];
