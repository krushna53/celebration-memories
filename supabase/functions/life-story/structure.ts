// Story → biography chapters + film script, in one OpenAI Responses call.
// The model reads the host's story text and looks at every attached photo
// (low-detail, so 80 photos stay cheap), then returns strict JSON. Photos
// are referred to as P1, P2, … so the model never handles real ids.
//
// parseStructure() is pure and unit-tested (tests/life-story.cjs).

export type Language = "english" | "hindi" | "gujarati" | "hinglish";
export type Motion = "zoom_in" | "zoom_out" | "pan_left" | "pan_right";

export const MAX_STORY_CHARS = 200_000;
export const MAX_AI_PHOTOS = 80;
export const MAX_CHAPTERS = 14;
export const MAX_SCENES = 40;
export const MAX_MILESTONES = 24;

export interface StructuredStory {
  title: string;
  subtitle: string;
  lifeSpan: string;
  dedication: string;
  chapters: { title: string; period: string; epigraph: string; epigraphSource: string; body: string; photoRefs: string[] }[];
  milestones: { period: string; title: string; description: string; photoRef: string }[];
  photos: { ref: string; caption: string; yearLabel: string; description: string }[];
  scenes: { photoRef: string; narration: string; caption: string; motion: Motion; animate: boolean; animationPrompt: string }[];
}

const LANGUAGE_NOTE: Record<Language, string> = {
  english: "Write the film narration in warm, simple English.",
  hindi: "Write the film narration in Hindi (Devanagari script). Chapters and captions stay in English.",
  gujarati: "Write the film narration in Gujarati (Gujarati script). Chapters and captions stay in English.",
  hinglish: "Write the film narration in natural Hinglish (Hindi in Latin script, mixed with English). Chapters and captions stay in English.",
};

function instructions(params: { subjectName: string; language: Language; maxAnimated: number }): string {
  return [
    `You are a gifted biographer — the kind whose books become bestsellers — and a documentary scriptwriter. You are writing the life story of ${params.subjectName}.`,
    "Use ONLY facts found in the story text. Never invent names, dates, places, jobs, numbers or events. If the story is vague, write warmly but stay vague — do not fill gaps with made-up detail. You may describe what is visible in a photo.",
    "",
    "1. Biography chapters (5–12), written the way a bestselling literary biography reads — narrative non-fiction, not a eulogy or a CV. Split the life into chapters in chronological order, as the story supports. Each chapter has:",
    "   - title: evocative and specific to this life (e.g. \"The Boy Who Sold Newspapers\", not just \"Childhood\");",
    "   - period: e.g. \"1951 – 1968\", or \"\" if unknown;",
    "   - epigraph: a short line (max 30 words) that someone in the story actually said or wrote, quoted exactly from the story text, that sets up the chapter — or \"\" if the story has no such line. Never invent or paraphrase a quote. epigraph_source: who said it (e.g. \"Mahesh, on his first day in Mumbai\"), or \"\";",
    "   - body: 4–8 paragraphs separated by blank lines, third person, past tense, English. Open with a scene or a vivid moment from the story rather than a summary. Weave in the family's own anecdotes, and their exact words as dialogue in quotation marks. Vary sentence length, give the reader a sense of place and time, and end each chapter on a line that carries the reader into the next. Plain prose only — no headings, lists, emoji or markdown. Never repeat the same opening move twice;",
    "   - photo_refs: the photos that belong with the chapter, in the order they should appear; each photo belongs to at most one chapter.",
    "2. Photos: for every photo you were shown, give a short caption (max 10 words, no invented names unless the story makes the person obvious), a year_label if the story or photo makes it clear (else \"\"), and a one-sentence plain description of what it shows.",
    `3. Film script (8–30 scenes) for a 2–5 minute narrated documentary. Each scene shows one photo (photo_ref, or \"\" for none) with 1–3 sentences of narration (12–40 words) that flow on from the previous scene, plus an on-screen caption (max 6 words, often a year or place, may be \"\"). Use the best photos; a photo may appear at most once. Open with a moment that hooks, close on legacy and love. motion: pick zoom_in, zoom_out, pan_left or pan_right to suit the composition. ${LANGUAGE_NOTE[params.language]}`,
    `4. animate: mark at most ${params.maxAnimated} scenes true — the most emotional photos with clear people, where gentle AI motion would move the viewer (a smile, a turn of the head, wind in hair, a slow push-in). For those, animation_prompt describes subtle, realistic motion in one sentence. Never ask for speech, new people, text, or changes to anyone's face. For all other scenes animate is false and animation_prompt is \"\".`,
    "5. title: the person's name as the family writes it; subtitle: a short heartfelt line (e.g. \"A Life of Love and Service\"); life_span: e.g. \"1951 – present\" if the birth year is known, else \"\".",
    "6. dedication: one short line for the book's dedication page, naming only people the story mentions (e.g. \"For his grandchildren, Aarav and Myra\"), or \"\" if it's unclear whom the family would dedicate it to.",
    "7. milestones (5–20): the life's key moments for a timeline, in chronological order — only moments whose time the story states or clearly implies. period: a year or range as the story gives it (e.g. \"1974\" or \"1980s\"); title: max 8 words; description: one sentence; photo_ref: the photo that best shows that moment, or \"\".",
  ].join("\n");
}

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "life_span", "dedication", "chapters", "milestones", "photos", "scenes"],
  properties: {
    title: str,
    subtitle: str,
    life_span: str,
    dedication: str,
    chapters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "period", "epigraph", "epigraph_source", "body", "photo_refs"],
        properties: { title: str, period: str, epigraph: str, epigraph_source: str, body: str, photo_refs: { type: "array", items: str } },
      },
    },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["period", "title", "description", "photo_ref"],
        properties: { period: str, title: str, description: str, photo_ref: str },
      },
    },
    photos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "caption", "year_label", "description"],
        properties: { ref: str, caption: str, year_label: str, description: str },
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["photo_ref", "narration", "caption", "motion", "animate", "animation_prompt"],
        properties: {
          photo_ref: str,
          narration: str,
          caption: str,
          motion: { type: "string", enum: ["zoom_in", "zoom_out", "pan_left", "pan_right"] },
          animate: { type: "boolean" },
          animation_prompt: str,
        },
      },
    },
  },
} as const;

const MOTIONS: readonly Motion[] = ["zoom_in", "zoom_out", "pan_left", "pan_right"];
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const asArray = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];

/**
 * Validates and cleans the model's JSON: drops unknown photo refs, keeps a
 * photo in at most one chapter and one scene, caps counts and the number of
 * animated scenes. Returns null when nothing usable came back.
 */
export function parseStructure(raw: unknown, validRefs: string[], maxAnimated: number): StructuredStory | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const known = new Set(validRefs);

  const usedInChapters = new Set<string>();
  const chapters = asArray(r.chapters)
    .map((c) => ({
      title: text(c.title, 160),
      period: text(c.period, 60),
      epigraph: text(c.epigraph, 400),
      epigraphSource: text(c.epigraph_source, 120),
      body: text(c.body, 20_000),
      photoRefs: (Array.isArray(c.photo_refs) ? c.photo_refs : [])
        .map((ref) => text(ref, 10))
        .filter((ref) => known.has(ref) && !usedInChapters.has(ref) && usedInChapters.add(ref)),
    }))
    .filter((c) => c.title && c.body)
    .slice(0, MAX_CHAPTERS);

  const photos = asArray(r.photos)
    .map((p) => ({
      ref: text(p.ref, 10),
      caption: text(p.caption, 160),
      yearLabel: text(p.year_label, 40),
      description: text(p.description, 400),
    }))
    .filter((p) => known.has(p.ref));

  const usedInScenes = new Set<string>();
  let animated = 0;
  const scenes = asArray(r.scenes)
    .map((s) => {
      let photoRef = text(s.photo_ref, 10);
      if (!known.has(photoRef) || usedInScenes.has(photoRef)) photoRef = "";
      if (photoRef) usedInScenes.add(photoRef);
      const motion = MOTIONS.includes(s.motion as Motion) ? (s.motion as Motion) : "zoom_in";
      const wantsAnimation = s.animate === true && Boolean(photoRef) && animated < maxAnimated;
      if (wantsAnimation) animated++;
      return {
        photoRef,
        narration: text(s.narration, 600),
        caption: text(s.caption, 80),
        motion,
        animate: wantsAnimation,
        animationPrompt: wantsAnimation ? text(s.animation_prompt, 400) : "",
      };
    })
    .filter((s) => s.narration)
    .slice(0, MAX_SCENES);

  const milestones = asArray(r.milestones)
    .map((m) => {
      const photoRef = text(m.photo_ref, 10);
      return {
        period: text(m.period, 60),
        title: text(m.title, 120),
        description: text(m.description, 500),
        photoRef: known.has(photoRef) ? photoRef : "",
      };
    })
    .filter((m) => m.period && m.title)
    .slice(0, MAX_MILESTONES);

  if (chapters.length === 0 || scenes.length === 0) return null;
  return {
    title: text(r.title, 160),
    subtitle: text(r.subtitle, 200),
    lifeSpan: text(r.life_span, 60),
    dedication: text(r.dedication, 600),
    chapters,
    milestones,
    photos,
    scenes,
  };
}

export async function structureStory(params: {
  apiKey: string;
  model: string;
  subjectName: string;
  language: Language;
  storyText: string;
  photos: { ref: string; url: string; caption: string }[];
  maxAnimated: number;
}): Promise<{ story: StructuredStory; inputTokens: number; outputTokens: number }> {
  const content: unknown[] = [
    { type: "input_text", text: `THE STORY (written by the family):\n\n${params.storyText.slice(0, MAX_STORY_CHARS)}` },
    {
      type: "input_text",
      text: params.photos.length
        ? `THE PHOTOS (${params.photos.length}), each labelled with its ref:`
        : "No photos were attached — use photo_ref \"\" everywhere and leave photos empty.",
    },
  ];
  for (const photo of params.photos) {
    content.push({ type: "input_text", text: `Photo ${photo.ref}${photo.caption ? ` — family's caption: "${photo.caption}"` : ""}` });
    content.push({ type: "input_image", image_url: photo.url, detail: "low" });
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.apiKey}` },
    body: JSON.stringify({
      model: params.model,
      instructions: instructions(params),
      input: [{ role: "user", content }],
      max_output_tokens: 48_000,
      text: { format: { type: "json_schema", name: "life_story", schema: SCHEMA, strict: true } },
    }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(`OpenAI request failed (${res.status}): ${payload?.error?.message ?? "unknown error"}`);

  // The REST API has no output_text shortcut (that's an SDK helper) — collect it from the message parts.
  const output = (payload.output ?? [])
    .filter((item: { type?: string }) => item.type === "message")
    .flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? [])
    .filter((part: { type?: string }) => part.type === "output_text")
    .map((part: { text?: string }) => part.text ?? "")
    .join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error(
      payload.status === "incomplete"
        ? "The story is too long for one pass — try trimming it a little."
        : "The AI returned something that wasn't valid JSON. Please try again.",
    );
  }
  const story = parseStructure(parsed, params.photos.map((p) => p.ref), params.maxAnimated);
  if (!story) throw new Error("The AI couldn't find enough in the story to write chapters. Add more detail and try again.");
  return {
    story,
    inputTokens: Number(payload.usage?.input_tokens) || 0,
    outputTokens: Number(payload.usage?.output_tokens) || 0,
  };
}

const VOICE_STYLE: Record<Language, string> = {
  english: "Warm, gentle Indian English documentary narrator. Unhurried and heartfelt, like a loved one telling the family story.",
  hindi: "Warm, gentle Hindi documentary narrator with natural Indian pronunciation. Unhurried and heartfelt.",
  gujarati: "Warm, gentle Gujarati documentary narrator with natural Gujarati pronunciation. Unhurried and heartfelt.",
  hinglish: "Warm, gentle Hinglish narrator — natural Indian Hindi pronunciation of Latin-script Hindi. Unhurried and heartfelt.",
};

/** One line of voiceover as raw 24 kHz 16-bit mono PCM (exact duration = bytes / 48000). */
export async function speak(params: { apiKey: string; text: string; language: Language }): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.apiKey}` },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TTS_MODEL") || "gpt-4o-mini-tts",
      voice: Deno.env.get("LIFE_STORY_TTS_VOICE") || "sage",
      input: params.text.slice(0, 600),
      instructions: VOICE_STYLE[params.language],
      response_format: "pcm",
    }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(`OpenAI voiceover failed (${res.status}): ${payload?.error?.message ?? "unknown error"}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
