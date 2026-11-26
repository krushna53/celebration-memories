// Love story reels shown on /wedding/stories (the Stories tab of the wedding galleries).
// To add a video: put the MP4 in public/videos/stories/ (e.g. story-3.mp4) and update its entry below.
// A poster image (same name, .jpg) is optional — without it the first frames of the video are used.
// Entries whose video file is missing are hidden from the page automatically.
export const STORY_VIDEOS = [
  {
    id: "story-1",
    title: "From college to forever",
    couple: "Shital & Rakesh",
    src: "/videos/stories/story-1.mp4",
    poster: "/videos/stories/story-1.jpg",
    duration: 39,
    tags: ["First meeting", "Diwali", "Mahabaleshwar trip"],
    description: "A shy hello in the college classroom, their first Diwali together and a weekend in Mahabaleshwar, all told as one animated story.",
    // Where the text is printed on this video ("top" or "bottom"); the editor covers it with editable text.
    textArea: "top",
    // Scenes in order, as shown on the video. They split the video into equal parts in the editor.
    scenes: [
      { title: "Our first meeting", date: "15 Sept 2021", location: "Surya College" },
      { title: "Enjoying", date: "5th Dec 2021", location: "Home" },
      { title: "A shared celebration", date: "23 Oct 2022", location: "Diwali" },
      { title: "Birthday Celebration", date: "16 Feb 2023", location: "Royal Banquet Hall" },
      { title: "A Trip", date: "7th Dec 2023", location: "Mahabaleshwar" },
      { title: "Coffee Date", date: "6 April 2024", location: "Hotel Raja" },
      { title: "Our promise", date: "5 Dec 2025", location: "Great Palace" },
      { title: "More memories ahead", date: "5th Jan 2026", location: "" },
    ],
  },
  {
    id: "story-2",
    title: "An office hello to engagement",
    couple: "Radha & Krishna",
    src: "/videos/stories/story-2.mp4",
    poster: "/videos/stories/story-2.jpg",
    duration: 29,
    tags: ["First meeting", "Road trip", "Engagement"],
    description: "It started with a handshake at work. A drive to Mahabaleshwar and an engagement at Chandani Lawns later, here is their story.",
    // Where the text is printed on this video ("top" or "bottom"); the editor covers it with editable text.
    textArea: "bottom",
    // Scenes in order, as shown on the video. They split the video into equal parts in the editor.
    scenes: [
      { title: "Our first meeting", date: "25th November 2025", location: "Office" },
      { title: "Coffee together", date: "5th December 2025", location: "Cozy Cafe" },
      { title: "Our favourite journey", date: "2nd February 2026", location: "Mahabaleshwar" },
      { title: "Our memory", date: "5th March 2026", location: "Hills" },
      { title: "With our loved ones", date: "25th April 2026", location: "Living Room" },
      { title: "Engagement Ceremony", date: "28th July 2026", location: "Chandani Lawns" },
      { title: "Wedding Invitation", date: "6th December 2026", location: "Muhurta Lawns, Bavdhan, Pune" },
    ],
  },
  {
    id: "story-3",
    title: "Our Journey Together",
    couple: "Nisha & Anand",
    src: "/videos/stories/story-3.mp4",
    poster: "/videos/stories/story-3.jpg",
    duration: 43,
    tags: ["Garden", "Road trip", "Airport", "Proposal"],
    description: "They met by chance in a garden, studied together in the library and took a road trip in a vintage car. Airport goodbyes, family time at home and a ring at Vishram Park complete their story.",
    // Where the text is printed on this video ("top" or "bottom"); the editor covers it with editable text.
    textArea: "top",
    // Scenes in order, as shown on the video. They split the video into equal parts in the editor.
    scenes: [
      { title: "A chance encounter", date: "15 Feb 2025", location: "Garden" },
      { title: "Library", date: "8 March 2025", location: "Library" },
      { title: "Road Trip", date: "17 June 2025", location: "Road Trip" },
      { title: "Celebrating together", date: "5 Sept 2025", location: "Rooftop" },
      { title: "Car Road Trip Date", date: "23 Dec 2025", location: "Car Date" },
      { title: "Airport", date: "5 Jan 2026", location: "Airport" },
      { title: "With our loved ones", date: "18 Feb 2026", location: "Home" },
      { title: "Happiness", date: "4 June 2026", location: "" },
      { title: "Surprise", date: "6 Nov 2026", location: "Vishram Park" },
    ],
  },
  {
    id: "story-4",
    title: "A beautiful journey",
    couple: "Aanchal & Kunal",
    src: "/videos/stories/story-4.mp4",
    poster: "/videos/stories/story-4.jpg",
    duration: 24,
    tags: ["First meeting", "Juhu Beach", "Wedding invitation"],
    description: "A handshake in the conference room turned into coffee dates and a walk on Juhu Beach. The ring came at the banquet hall, and this story ends with an invitation to their wedding at the Taj.",
    // Where the text is printed on this video ("top" or "bottom"); the editor covers it with editable text.
    textArea: "top",
    // Scenes in order, as shown on the video. They split the video into equal parts in the editor.
    scenes: [
      { title: "Our first meeting", date: "25th Dec 2025", location: "Conference Room" },
      { title: "Coffee together", date: "25th Jan 2026", location: "Cozy Cafe" },
      { title: "Our favourite journey", date: "19th March 2026", location: "Juhu Beach" },
      { title: "Our next promise", date: "8th June 2026", location: "Banquet Hall" },
      { title: "Wedding Invitation", date: "5th Dec 2026", location: "Taj Hotel" },
    ],
  },
  {
    id: "story-5",
    title: "Flowers, pottery and a fort trip",
    couple: "Jasmine & Sahil",
    src: "/videos/stories/story-5.mp4",
    poster: "/videos/stories/story-5.jpg",
    duration: 26,
    tags: ["First meeting", "Pottery workshop", "Movie date", "Fort trip"],
    description: "It began with a bouquet in a flower garden. A pottery workshop, a Holi surprise at home, a movie date and a walk through an old fort followed, with more memories still to come.",
    // Where the text is printed on this video ("top" or "bottom"); the editor covers it with editable text.
    textArea: "bottom",
    // Scenes in order, as shown on the video. They split the video into equal parts in the editor.
    scenes: [
      { title: "First Meeting", date: "6th April 2025", location: "Flower Garden" },
      { title: "Pottery workshop", date: "9 Sept 2025", location: "Pottery workshop" },
      { title: "A little surprise", date: "4 Feb 2026", location: "Home" },
      { title: "Romantic Movie Date", date: "5 March 2026", location: "AM Mall" },
      { title: "Fort Trip", date: "19 May 2026", location: "Fort" },
      { title: "More memories ahead", date: "", location: "" },
    ],
  },
  {
    id: "story-6",
    title: "Our first hello to together forever",
    couple: "Meera & Govinda",
    src: "/videos/stories/story-6.mp4",
    poster: "/videos/stories/story-6.jpg",
    duration: 43,
    tags: ["Train journey", "Proposal", "Bonfire date", "Celebration"],
    description: "A train journey through the hills, candlelit dinners and rainy evenings brought them closer. A proposal at Vienna Palace and a bonfire date lead to the day they celebrate together forever.",
    // Where the text is printed on this video ("top" or "bottom"); the editor covers it with editable text.
    textArea: "top",
    // Scenes in order, as shown on the video. They split the video into equal parts in the editor.
    scenes: [
      { title: "Our first hello", date: "5 Jan 2025", location: "Home" },
      { title: "Train Journey", date: "8 March 2025", location: "Mumbai Station" },
      { title: "Always by your side", date: "7 Jun 2025", location: "Home" },
      { title: "Rain Dance", date: "19 Sept 2025", location: "A Silent Road" },
      { title: "Together again", date: "9 Dec 2025", location: "Home" },
      { title: "Achievement", date: "7 Feb 2026", location: "Office" },
      { title: "Our next promise", date: "10 April 2026", location: "Vienna Palace" },
      { title: "A new adventure", date: "19 July 2026", location: "Bonfire Date" },
      { title: "Together Forever", date: "5 November 2026", location: "Celebration" },
    ],
  },
];

export const STORY_PAGE_PATH = "/wedding/stories";
// Shareable page for one story, e.g. /wedding/stories/story-6 (has its own link preview).
export const storyPath = (id) => `${STORY_PAGE_PATH}/${id}`;
export const CREATE_STORY_PATH = "/wedding/stories/create";
