export type BlogPost = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  image: string;
  imageAlt: string;
  tags?: string[];
  sections: { heading: string; body: string }[];
  quote?: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "dreamy-wedding-decoration-ideas",
    category: "Wedding Ideas",
    title: "Dreamy Wedding Decoration Ideas for Your Big Day",
    excerpt: "From floral mandaps to elegant lighting, find thoughtful details that make your celebration feel like you.",
    date: "Nov 25, 2026",
    readTime: "5 min read",
    image: "/wedding-demo-royal.webp",
    imageAlt: "A flower-framed mandap glowing with warm lights",
    sections: [
      { heading: "Create a floral focal point", body: "A mandap, ceremony arch, or entrance framed with flowers gives your celebration a natural centrepiece. Choose blooms that are in season and repeat a few of them across the tables for a look that feels considered." },
      { heading: "Let lighting set the mood", body: "Warm fairy lights, candles, and shaded lamps bring a soft glow to an evening celebration. Layer a few types of light so guests can see comfortably while the room still feels intimate." },
      { heading: "Choose a palette with meaning", body: "Start with colours you already love, then add one accent from your venue or family traditions. Repeating that palette in flowers, linens, and stationery helps each part of the day feel connected." },
    ],
    quote: "A beautiful wedding is made of the little details that feel like you.",
  },
  {
    slug: "digital-invitations-that-feel-personal",
    category: "Invitations",
    title: "Digital Invitations That Still Feel Personal",
    excerpt: "A few small choices can turn a convenient online invitation into a warm, memorable first hello.",
    date: "Nov 20, 2026",
    readTime: "4 min read",
    image: "/art/couples/couple-lotus-dawn.webp",
    imageAlt: "A couple sharing a quiet moment at sunrise",
    sections: [
      { heading: "Open with your story", body: "A short note in your own voice makes an invitation feel like it came from you. Share what you are celebrating and why having your guest there matters." },
      { heading: "Make the details easy to find", body: "Keep the date, time, venue, and RSVP action clear and close together. Guests should be able to check the essentials in a few seconds on their phone." },
      { heading: "Add one personal touch", body: "A favourite photo, a meaningful song, or a line from your family tradition is often enough. A personal detail can make a simple design feel truly yours." },
    ],
  },
  {
    slug: "from-first-hello-to-forever",
    category: "Love Stories",
    title: "From First Hello to Forever",
    excerpt: "A gentle guide to collecting the moments and memories that make your celebration uniquely yours.",
    date: "Nov 18, 2026",
    readTime: "4 min read",
    image: "/art/couples/couple-orchid-evening.webp",
    imageAlt: "A couple together beneath an evening sky",
    sections: [
      { heading: "Keep the small moments", body: "The story is often in the in-between: a shared laugh while getting ready, a quiet family blessing, or friends meeting again. Make space for these alongside the big milestones." },
      { heading: "Invite loved ones to add their memories", body: "Ask family and friends to share a photo or a short note. Their perspectives become a lovely companion to the photographs you planned." },
      { heading: "Give yourself time to enjoy it", body: "A relaxed timeline leaves room for the day to unfold. Build in a few pauses, and let someone you trust handle the small logistics." },
    ],
    quote: "The best stories are the ones everyone helps you remember.",
  },
  {
    slug: "bridal-looks-to-inspire-you",
    category: "Wedding Ideas",
    title: "Bridal Looks to Inspire You",
    excerpt: "Find a bridal style that feels comfortable, expressive, and completely your own.",
    date: "Nov 15, 2026",
    readTime: "5 min read",
    image: "/art/couples/couple-rajasthani-gulabi.webp",
    imageAlt: "Traditional wedding attire in warm rose and gold tones",
    sections: [
      { heading: "Start with how you want to feel", body: "Before choosing a look, picture how you want to move through the day. Comfort and confidence are as important as colour, embroidery, or silhouette." },
      { heading: "Bring tradition into your own style", body: "A family heirloom, a familiar motif, or a contemporary colour can help your outfit feel personal while honouring the moments and people that matter to you." },
      { heading: "Try the whole look together", body: "Wear your chosen shoes and jewellery during a fitting. A full rehearsal makes it easier to spot adjustments and enjoy the day without fuss." },
    ],
  },
  {
    slug: "beautiful-haldi-celebration-ideas",
    category: "Celebrations",
    title: "Beautiful Haldi Celebration Ideas",
    excerpt: "Bring family, colour, and a little sunshine together for a joyful Haldi celebration.",
    date: "Nov 12, 2026",
    readTime: "4 min read",
    image: "/art/couples/couple-tamil-jasmine.webp",
    imageAlt: "A colourful and joyful Indian wedding celebration",
    sections: [
      { heading: "Keep the gathering relaxed", body: "Set up a comfortable area with shade, water, and room for family to gather. A simple layout makes it easier for everyone to be part of the ceremony." },
      { heading: "Use marigolds and bright accents", body: "Fresh flowers, colourful cushions, and a few handmade signs can make a welcoming backdrop without overcomplicating the setup." },
      { heading: "Plan for keepsake photos", body: "Choose one well-lit corner for portraits and keep a towel or shawl nearby. Guests can take turns sharing candid moments without interrupting the ceremony." },
    ],
  },
  {
    slug: "wedding-film-reel-ideas",
    category: "AI Videos",
    title: "Wedding Film Reel Ideas to Keep the Feeling",
    excerpt: "Turn a few favourite photos and little details into a short film you will love sharing.",
    date: "Nov 11, 2026",
    readTime: "4 min read",
    image: "/videos/stories/story-1.jpg",
    imageAlt: "A wedding memory captured as a short film",
    sections: [
      { heading: "Choose moments that tell one story", body: "A short reel feels more personal when its photos and clips follow a simple idea: getting ready, the ceremony, or a favourite family moment. Choose a few strong scenes instead of trying to include everything." },
      { heading: "Keep the words and music simple", body: "A date, a name, or a short line can add context without covering the image. Pick music that feels right for you and check that it is suitable for the place you plan to share the video." },
      { heading: "Make it easy to watch on a phone", body: "Vertical framing, readable captions, and a concise runtime help friends and family enjoy the reel wherever they are." },
    ],
  },
  {
    slug: "the-magic-of-mehendi-ceremony",
    category: "Traditions",
    title: "The Magic of a Mehendi Ceremony",
    excerpt: "Celebrate the artistry, music, and togetherness at the heart of a Mehendi gathering.",
    date: "Nov 10, 2026",
    readTime: "5 min read",
    image: "/art/couples/couple-rosewood-vows.webp",
    imageAlt: "Intricate henna-inspired wedding details",
    sections: [
      { heading: "Make room for the artist", body: "A comfortable seat, steady light, and a small table nearby help the Mehendi artist work with ease. Leave enough time so the celebration can stay unhurried." },
      { heading: "Gather around the ritual", body: "Music, stories, and a few favourite snacks make the waiting time part of the celebration. Invite loved ones to share a song or a memory." },
      { heading: "Keep the schedule flexible", body: "Henna takes time to apply and dry. A relaxed schedule lets guests come and go while keeping the focus on enjoying each other's company." },
    ],
    quote: "Tradition lives in the moments we share together.",
  },
];

export const BLOG_CATEGORIES = ["All", "Wedding Ideas", "Invitations", "Love Stories", "AI Videos", "Traditions", "Celebrations"] as const;

