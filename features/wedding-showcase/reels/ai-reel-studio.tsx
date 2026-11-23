
"use client";

import { renderWeddingMp4 } from "./render-wedding-mp4";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  Music2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import TemplateReel from "./TemplateReel";
import {
  GHAR_CAPTIONS,
  REEL_TEMPLATES,
  TEMPLATE_EVENTS,
  reelTemplate,
} from "./reel-templates";

const STARTER_PROMPT =
  "Create a vertical 9:16 animated Indian wedding film using the uploaded couple photo as the identity reference. Keep the couple recognisable throughout the film. Use expressive illustrated faces, elegant traditional wedding styling, warm cinematic lighting, graceful movement and beautiful detailed backgrounds. Create a separate visual moment for every selected ceremony, following the supplied scene descriptions, outfits and locations. Keep the upper and lower portions visually clean for a separately added invitation overlay. Absolutely no visible text, letters, numbers, names, dates, times, captions, subtitles, signs, logos or watermarks. No spoken dialogue.";

const WEDDING_STYLES = [
  "Marathi wedding",
  "Marwadi wedding",
  "Bengali wedding",
  "Gujarati wedding",
  "South Indian wedding",
  "Christian wedding",
  "Sikh wedding",
  "Muslim wedding",
];

const CEREMONIES = [
  "Sagan",
  "Engagement",
  "Cocktail",
  "Mehendi",
  "Haldi",
  "Sangeet",
  "Baraat",
  "Pheras",
  "Reception",
];

// Default visual descriptions for every ceremony.
// These descriptions are automatically added when a ceremony is selected.
const SCENE_DEFAULT_PROMPTS: Record<string, string> = {
  Sagan:
    "Show an intimate traditional Indian pre-wedding blessing ceremony. The families gather around the couple in an elegant decorated setting. Elders lovingly bless the couple and exchange gifts and sweets. Capture warm smiles, graceful gestures, traditional decorations, flowers and a joyful family atmosphere. Use cinematic close-ups and gentle camera movement.",

  Engagement:
    "Show a beautiful Indian engagement ceremony. The bride and groom stand together on an elegant floral stage surrounded by family and friends. Capture the ring exchange, happy expressions, applause and a romantic moment between the couple. Use sparkling decorative lights, elegant floral arrangements and cinematic camera movement.",

  Cocktail:
    "Show a glamorous evening cocktail celebration. The couple enters a beautifully decorated modern venue with elegant lighting, chandeliers and stylish floral arrangements. Guests celebrate in the background while the couple enjoys a romantic dance and joyful moments together. Create a sophisticated cinematic party atmosphere.",

  Mehendi:
    "Show a colourful traditional Mehendi ceremony in a beautifully decorated courtyard. The bride sits gracefully while intricate henna designs are applied to her hands. Female relatives and friends celebrate around her with flowers, colourful cushions, marigold decorations and traditional festive details. Capture the bride smiling and showing her decorated hands.",

  Haldi:
    "Show a joyful traditional Haldi ceremony in a bright outdoor courtyard decorated with yellow marigolds, floral strings and traditional brass elements. Family members gently apply turmeric paste to the bride and groom. Capture laughter, playful moments, flower petals and warm sunlight. Create a vibrant golden-yellow festive atmosphere.",

  Sangeet:
    "Show a lively Indian Sangeet celebration on a beautifully decorated stage. The bride and groom perform a graceful dance together while family members celebrate around them. Include colourful stage lighting, elegant decorations, flowing outfits, joyful expressions and energetic dance movements. Create a cinematic musical celebration.",

  Baraat:
    "Show a grand Indian wedding Baraat procession. The groom arrives in a traditional royal style surrounded by family and friends dancing joyfully. Include a decorated wedding horse or elegant groom entrance where appropriate, traditional musicians, festive lights, flower petals and a beautifully decorated wedding entrance. Capture the excitement and grandeur of the procession.",

  Pheras:
    "Show an emotional traditional Hindu wedding ceremony around a beautifully decorated sacred fire. The bride and groom perform the wedding pheras together, dressed in elegant traditional wedding attire. Include a beautifully decorated mandap, flowers, glowing diyas, family members witnessing the ceremony and warm sacred firelight. Keep the atmosphere intimate, graceful and cinematic.",

  Reception:
    "Show a grand and elegant wedding reception. The bride and groom stand together on a luxurious floral stage with beautiful lighting and sophisticated decorations. Capture romantic couple moments, warm smiles, family celebrations and a graceful walk together. Use a royal cinematic atmosphere with soft golden lighting.",
};

type WeddingScene = {
  ceremony: string;
  description: string;
  location: string;
  date: string;
  time: string;
  overlayText: string;
  brideOutfit: string;
  groomOutfit: string;
};

function createWeddingScene(ceremony: string): WeddingScene {
  return {
    ceremony,
    description:
      SCENE_DEFAULT_PROMPTS[ceremony] ??
      `Create a beautiful and cinematic visual moment for the ${ceremony} ceremony. Show the bride and groom participating naturally in this traditional wedding celebration, with elegant decorations, family celebrations, expressive faces and graceful movement.`,
    location: "",
    date: "",
    time: "",
    overlayText: ceremony,
    brideOutfit: "",
    groomOutfit: "",
  };
}

type TextPosition = "top" | "bottom";

type EditorState = {
  bride: string;
  groom: string;
  ceremony: string;
  date: string;
  time: string;
  venue: string;
  family: string;
  colour: "ivory" | "gold" | "ink";
  size: "regular" | "large";
  position: TextPosition;
};

const DEFAULTS: EditorState = {
  bride: "Aarohi",
  groom: "Reyansh",
  ceremony: "Wedding Ceremony",
  date: "Saturday, 14 February 2027",
  time: "7:30 PM onwards",
  venue: "The Marigold Palace, Udaipur",
  family: "",
  colour: "ivory",
  size: "regular",
  position: "top",
};

const sampleVideo = "/reels/wedding-invitation-reel.mp4";

type ReelEvent = {
  name: string;
  when: string;
};

type Template = NonNullable<ReturnType<typeof reelTemplate>>;

const EVENT_LOOKS = TEMPLATE_EVENTS as Record<string, ReelEvent[]>;

const FAMILY_LABEL: Record<string, string> = {
  tour: "Website link",
  ghar: "Signboard text",
};

type Quote = {
  token: string;
  totalUsd: number | null;
  seconds: number;
  resolution: string;
};

type Job = {
  state: string;
  videoUrl?: string;
  downloadToken?: string;
  error?: string;
  actualCostUsd?: number | null;
  estimatedUsd?: number | null;
};

// This marker separates the editable base prompt from the
// automatically generated wedding scene instructions.
const SCENE_PROMPT_MARKER =
  "\n\nWEDDING STYLE & SCENE DIRECTIONS:\n";

export function AiReelStudio() {
  const searchParams = useSearchParams();

  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState("");

  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [actualVideoDuration, setActualVideoDuration] = useState(0);

  const [tab, setTab] = useState<"edit" | "generate">("edit");
  const [details, setDetails] = useState<EditorState>(DEFAULTS);

  const [weddingStyle, setWeddingStyle] = useState("");
  const [weddingScenes, setWeddingScenes] = useState<WeddingScene[]>([]);

  const [generationPrompt, setGenerationPrompt] =
    useState(STARTER_PROMPT);

  const [videoDuration, setVideoDuration] = useState<5 | 10 | 15>(15);

  const [fontStyle, setFontStyle] = useState("Elegant Script");
  const [textDecoration, setTextDecoration] = useState("Royal Frame");
  const [textPosition, setTextPosition] = useState<TextPosition>("top");

  const [videoUrl, setVideoUrl] = useState(sampleVideo);
  const [videoName, setVideoName] = useState("Wedding Film Reel");

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState("");
  const [photoHash, setPhotoHash] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const [generationError, setGenerationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [template, setTemplate] = useState<Template | null>(null);
  const [events, setEvents] = useState<ReelEvent[]>([]);
  const [captions, setCaptions] = useState<string[]>(GHAR_CAPTIONS);
  const [photos, setPhotos] = useState<string[]>([]);

  const [showOverlay, setShowOverlay] = useState(false);
  const [isGeneratedVideo, setIsGeneratedVideo] = useState(false);

  const video = useRef<HTMLVideoElement>(null);
  const objectUrls = useRef<string[]>([]);

  // Select the scene based on the current video playback time.
  const activeWeddingScene = useMemo(() => {
    if (!weddingScenes.length) return null;

    const duration = actualVideoDuration || videoDuration;
    const sceneDuration = duration / weddingScenes.length;

    const index = Math.min(
      weddingScenes.length - 1,
      Math.floor(
        currentVideoTime / Math.max(sceneDuration, 0.001)
      )
    );

    return weddingScenes[index] ?? weddingScenes[0] ?? null;
  }, [
    weddingScenes,
    currentVideoTime,
    actualVideoDuration,
    videoDuration,
  ]);

  // Combine the main prompt with the selected wedding style
  // and every scene's description, location and outfit details.
  const combinedGenerationPrompt = useMemo(() => {
    const sceneInstructions = weddingScenes
      .map((scene, index) => {
        const visualDetails = [
          `What happens: ${
            scene.description.trim() ||
            SCENE_DEFAULT_PROMPTS[scene.ceremony] ||
            `Create a beautiful visual moment for the ${scene.ceremony} ceremony.`
          }`,
          scene.location.trim()
            ? `Visual location: ${scene.location.trim()}`
            : "",
          scene.brideOutfit.trim()
            ? `Bride outfit: ${scene.brideOutfit.trim()}`
            : "",
          scene.groomOutfit.trim()
            ? `Groom outfit: ${scene.groomOutfit.trim()}`
            : "",
        ].filter(Boolean);

        return [
          `SCENE ${index + 1}: ${scene.ceremony}`,
          ...visualDetails,
        ].join("\n");
      })
      .join("\n\n");

    const styleInstructions = weddingStyle.trim()
      ? `Wedding style: ${weddingStyle.trim()}`
      : "Wedding style: Traditional Indian wedding style. Follow the selected ceremony details.";

    const sceneSection = weddingScenes.length
      ? sceneInstructions
      : "No ceremony scenes selected yet. Add ceremony scenes to generate scene-by-scene directions.";

    return [
      generationPrompt.trim(),
      SCENE_PROMPT_MARKER.trim(),
      styleInstructions,
      "",
      "Create the following scenes in the exact selected order:",
      sceneSection,
      "",
      "GLOBAL VIDEO INSTRUCTIONS:",
      "- Use the uploaded couple photo as the identity reference.",
      "- Keep both people recognisable and visually consistent throughout the film.",
      "- Preserve their facial features, skin tones and overall appearance.",
      "- Create a separate visual moment for every selected ceremony.",
      "- Follow the supplied scene descriptions, outfits and visual locations.",
      "- Use elegant traditional wedding styling appropriate to the selected wedding style.",
      "- Use expressive illustrated faces, graceful movement and cinematic camera work.",
      "- Use warm cinematic lighting and beautifully detailed backgrounds.",
      "- Create smooth transitions between the selected ceremony scenes.",
      "- Keep the upper and lower portions visually clean for a separately added invitation overlay.",
      "- Generate visual animation only. The website will add invitation lettering separately after video generation.",
      "- Do not generate visible text, letters, numbers, names, dates, times, ceremony headings, captions, subtitles, signs, logos, watermarks or fake writing.",
      "- Do not include spoken dialogue.",
    ]
      .filter(Boolean)
      .join("\n");
  }, [generationPrompt, weddingStyle, weddingScenes]);

  // The main textarea displays the combined prompt.
  // Only its main editable section is saved as generationPrompt.
  function handleGenerationPromptChange(value: string) {
    const markerIndex = value.indexOf(SCENE_PROMPT_MARKER);

    const editablePrompt =
      markerIndex >= 0
        ? value.slice(0, markerIndex).trim()
        : value;

    setGenerationPrompt(editablePrompt);
    setQuote(null);
    setJob(null);
  }

  // Render the generated video with invitation text permanently added.
  async function downloadRenderedVideo() {
  if (!videoUrl || !isGeneratedVideo) return;

  const downloadToken = job?.downloadToken;

  if (!downloadToken) {
    setRenderError("Download confirmation is missing. Please check video status again.");
    return;
  }

  let sourceObjectUrl = "";

  setIsRendering(true);
  setRenderProgress(0);
  setRenderError("");

  try {
    // Fetch the xAI video through our own server.
    const response = await fetch("/api/ai-reel/download", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: downloadToken }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(
        result.error || "Could not download the generated video."
      );
    }

    const sourceBlob = await response.blob();

    if (!sourceBlob.size) {
      throw new Error("The generated video file is empty.");
    }

    // Create a local URL for the video renderer.
    sourceObjectUrl = URL.createObjectURL(sourceBlob);

    const blob = await renderWeddingMp4(
      sourceObjectUrl,
      {
        bride: details.bride,
        groom: details.groom,
        scenes: weddingScenes,
        fontStyle,
        textDecoration,
        textPosition,
      },
      setRenderProgress
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "wedding-invitation.mp4";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    setRenderError(
      error instanceof Error
        ? error.message
        : "Could not render the final MP4."
    );
  } finally {
    if (sourceObjectUrl) {
      URL.revokeObjectURL(sourceObjectUrl);
    }

    setIsRendering(false);
  }
}

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const slug = searchParams.get("template");
    const chosen = slug ? reelTemplate(slug) : undefined;

    if (chosen) {
      applyTemplate(chosen);
    } else if (slug) {
      setTab("generate");
    }
  }, [searchParams]);

  function applyTemplate(chosen: Template | null) {
    setTemplate(chosen);
    setIsGeneratedVideo(false);

    if (!chosen) {
      setIsPlaying(false);
      return;
    }

    setDetails((current) => ({
      ...current,
      ...chosen.defaults,
    }));

    setEvents(
      (EVENT_LOOKS[chosen.look] ?? []).map((item) => ({ ...item }))
    );

    setCaptions(GHAR_CAPTIONS);
    setPhotos([]);
    setQuote(null);
    setJob(null);
    setVideoName(chosen.title);
    setTab("edit");
    setIsPlaying(true);
    setShowOverlay(true);
  }

  function chooseLook(slug: string) {
    applyTemplate(slug ? reelTemplate(slug) ?? null : null);
  }

  function updateEvent(
    index: number,
    key: keyof ReelEvent,
    value: string
  ) {
    setEvents((current) =>
      current.map((item, at) =>
        at === index ? { ...item, [key]: value } : item
      )
    );
  }

  function chooseScenePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 4);

    if (!files.length) return;

    const urls = files.map((file) => URL.createObjectURL(file));
    objectUrls.current.push(...urls);
    setPhotos(urls);
  }

  // Existing template/uploaded-video overlay position.
  const overlayClass = useMemo(
    () =>
      `absolute inset-x-4 z-10 grid justify-items-center text-center ${
        details.position === "top" ? "top-7" : "bottom-8"
      }`,
    [details.position]
  );

  // AI-generated invitation overlay position.
  const generatedOverlayClass = useMemo(
    () =>
      `absolute inset-x-4 z-10 grid justify-items-center text-center ${
        textPosition === "top" ? "top-7" : "bottom-8"
      }`,
    [textPosition]
  );

  const tone =
    details.colour === "gold"
      ? "text-gold-300"
      : details.colour === "ink"
        ? "text-navy-950"
        : "text-ivory-50";

  const shadow =
    details.colour === "ink" ? "bg-ivory-50/85" : "bg-navy-950/35";

  // Font mapping for the AI-generated invitation preview.
  const generatedFontFamily =
    fontStyle === "Elegant Script"
      ? '"Brush Script MT", "Segoe Script", cursive'
      : fontStyle === "Royal Serif"
        ? "Georgia, serif"
        : fontStyle === "Classic Serif"
          ? '"Times New Roman", serif'
          : fontStyle === "Modern Minimal"
            ? "Arial, sans-serif"
            : '"Palatino Linotype", "Book Antiqua", serif';

  // Decorative frame mapping for the AI-generated invitation.
  const generatedFrameClass =
    textDecoration === "Royal Frame"
      ? "border-4 border-double border-amber-300 bg-navy-950/45"
      : textDecoration === "Floral Border"
        ? "border-2 border-dotted border-pink-200 bg-navy-950/45"
        : textDecoration === "Classic Gold Border"
          ? "border-2 border-amber-400 bg-navy-950/45"
          : textDecoration === "Elegant Background Box"
            ? "border border-white/20 bg-navy-950/65 backdrop-blur-sm"
            : "border-0 bg-transparent";

  function update<K extends keyof EditorState>(
    key: K,
    value: EditorState[K]
  ) {
    setDetails((current) => ({
      ...current,
      [key]: value,
    }));
  }

  // Upload an existing video for the Edit a reel tab.
  function chooseVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);

    setVideoUrl(url);
    setVideoName(file.name.replace(/\.[^.]+$/, ""));
    setTemplate(null);
    setIsGeneratedVideo(false);
    setShowOverlay(true);
    setTab("edit");
    setIsPlaying(false);
    setCurrentVideoTime(0);
    setActualVideoDuration(0);
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      !/^image\/(jpeg|png|webp)$/.test(file.type) ||
      file.size > 3000000
    ) {
      setGenerationError(
        "Choose a JPG, PNG or WebP photo under 3 MB."
      );
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);

      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Could not read this photo."));

        reader.readAsDataURL(file);
      });

      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer()
      );

      const hash = Array.from(
        new Uint8Array(hashBuffer),
        (item) => item.toString(16).padStart(2, "0")
      ).join("");

      setPhotoUrl(url);
      setPhotoData(data);
      setPhotoHash(hash);
      setQuote(null);
      setJob(null);
      setGenerationError("");
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Could not upload this photo."
      );
    }
  }

  function removePhoto() {
    setPhotoUrl(null);
    setPhotoData("");
    setPhotoHash("");
    setQuote(null);
    setJob(null);
    setGenerationError("");
  }

  function toggleWeddingCeremony(ceremony: string) {
    setWeddingScenes((current) => {
      const exists = current.some(
        (scene) => scene.ceremony === ceremony
      );

      if (exists) {
        return current.filter(
          (scene) => scene.ceremony !== ceremony
        );
      }

      if (current.length >= 9) return current;

      return [...current, createWeddingScene(ceremony)];
    });

    setQuote(null);
    setJob(null);
  }

  function updateWeddingScene(
    index: number,
    key: keyof WeddingScene,
    value: string
  ) {
    setWeddingScenes((current) =>
      current.map((scene, at) =>
        at === index ? { ...scene, [key]: value } : scene
      )
    );

    setQuote(null);
    setJob(null);
  }

  async function reviewCost() {
    if (!photoData || !photoHash) {
      setGenerationError("Upload the couple photo first.");
      return;
    }

    if (!weddingStyle) {
      setGenerationError("Choose a valid wedding style.");
      return;
    }

    if (weddingScenes.length === 0) {
      setGenerationError("Choose at least one ceremony.");
      return;
    }

    setBusy(true);
    setGenerationError("");
    setQuote(null);
    setJob(null);

    // Send the exact combined prompt to the quote API.
    const finalPrompt = combinedGenerationPrompt;

    try {
      const response = await fetch("/api/ai-reel/quote", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          photoHash,
          weddingStyle,
          scenes: weddingScenes,
          seconds: videoDuration,
          resolution: "720p",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not calculate generation credits."
        );
      }

      if (!result.token) {
        throw new Error("The quote response did not include a token.");
      }

      setQuote({
        token: result.token,
        totalUsd:
          result.totalUsd == null
            ? null
            : Number(result.totalUsd),
        seconds: Number(result.seconds ?? videoDuration),
        resolution: String(result.resolution ?? "720p"),
      });
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Could not review the generation cost."
      );
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!quote) return;

    setBusy(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/ai-reel/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: quote.token,
          confirmed: true,
          image: photoData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not start the video generation."
        );
      }

setJob({ ...result, downloadToken: quote.token });
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Could not start the video."
      );
    } finally {
      setBusy(false);
    }
  }

  async function checkProgress() {
    if (!quote) return;

    setBusy(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/ai-reel/status", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: quote.token,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not check video progress."
        );
      }

setJob({ ...result, downloadToken: quote.token });
      if (result.videoUrl) {
        setVideoUrl(result.videoUrl);
        setVideoName("AI generated wedding reel");
        setTemplate(null);
        setIsGeneratedVideo(true);
        setShowOverlay(true);
        setTab("generate");
        setIsPlaying(false);
        setCurrentVideoTime(0);
        setActualVideoDuration(0);
      }
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Could not check video progress."
      );
    } finally {
      setBusy(false);
    }
  }

  function togglePlay() {
    if (template) {
      setIsPlaying((playing) => !playing);
      return;
    }

    const current = video.current;

    if (!current) return;

    if (current.paused) {
      void current.play();
      setIsPlaying(true);
    } else {
      current.pause();
      setIsPlaying(false);
    }
  }

  const actualCost =
    job?.actualCostUsd == null
      ? null
      : Number(job.actualCostUsd);

  const estimatedCost =
    quote?.totalUsd == null
      ? null
      : Number(quote.totalUsd);

  return (
    <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[.28em] text-gold-600">
            AI wedding video
          </p>

          <h1 className="mt-3 font-display text-4xl text-navy-950 sm:text-5xl">
            Your story, ready for a reel.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-navy-700">
            Edit the lettering on your reel or create a new animated
            wedding film from your couple photo. Every preview is 9:16
            for Instagram and WhatsApp.
          </p>
        </div>

        <div className="mx-auto mt-9 flex w-fit max-w-full rounded-full border border-navy-950/10 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === "edit"
                ? "bg-navy-950 text-ivory-50"
                : "text-navy-700"
            }`}
          >
            Edit a reel
          </button>

          <button
            type="button"
            onClick={() => setTab("generate")}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              tab === "generate"
                ? "bg-navy-950 text-ivory-50"
                : "text-navy-700"
            }`}
          >
            Create AI video
          </button>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
          <section className="rounded-3xl border border-navy-950/10 bg-white p-5 shadow-sm sm:p-7">
            {tab === "edit" ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-600">
                      Reel editor
                    </p>

                    <h2 className="mt-1 font-display text-2xl text-navy-950">
                      {template
                        ? "Edit your reel"
                        : "Edit the text over your video"}
                    </h2>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-ivory-50">
                    <Upload size={15} />
                    Upload MP4
                    <input
                      className="sr-only"
                      accept="video/mp4,video/webm,video/quicktime"
                      type="file"
                      onChange={chooseVideo}
                    />
                  </label>
                </div>

                <p className="mt-3 text-sm text-navy-700/70">
                  Currently editing:{" "}
                  <b className="text-navy-950">{videoName}</b>.
                </p>

                <label className="mt-5 block text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">
                  Reel style
                  <select
                    value={template?.slug ?? ""}
                    onChange={(event) => chooseLook(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                  >
                    {REEL_TEMPLATES.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.title} — animated template
                      </option>
                    ))}
                  </select>
                </label>

                {template ? (
                  <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Bride name"
                      value={details.bride}
                      onChange={(value) => update("bride", value)}
                    />

                    <Field
                      label="Groom name"
                      value={details.groom}
                      onChange={(value) => update("groom", value)}
                    />

                    <Field
                      label="Ceremony"
                      value={details.ceremony}
                      onChange={(value) => update("ceremony", value)}
                    />

                    <Field
                      label="Date"
                      value={details.date}
                      onChange={(value) => update("date", value)}
                    />

                    <Field
                      label="Time"
                      value={details.time}
                      onChange={(value) => update("time", value)}
                    />

                    <Field
                      label="Venue / address"
                      value={details.venue}
                      onChange={(value) => update("venue", value)}
                    />

                    {FAMILY_LABEL[template.look] && (
                      <Field
                        label={FAMILY_LABEL[template.look] ?? "Additional details"}
                        value={details.family}
                        onChange={(value) => update("family", value)}
                      />
                    )}
                  </div>
                ) : (
                  <>
                    <label className="mt-6 flex items-start gap-3 rounded-xl border border-navy-950/10 bg-ivory-50 p-4 text-sm text-navy-700">
                      <input
                        type="checkbox"
                        checked={showOverlay}
                        onChange={(event) =>
                          setShowOverlay(event.target.checked)
                        }
                        className="mt-1"
                      />

                      <span>
                        <b className="block text-navy-950">
                          Add editable lettering over this video
                        </b>
                        <span className="mt-1 block text-xs text-navy-700/65">
                          Keep this switched off if your uploaded video
                          already contains its own lettering. This avoids
                          adding a second text layer.
                        </span>
                      </span>
                    </label>

                    {showOverlay && (
                      <>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                          <Field
                            label="Bride name"
                            value={details.bride}
                            onChange={(value) => update("bride", value)}
                          />

                          <Field
                            label="Groom name"
                            value={details.groom}
                            onChange={(value) => update("groom", value)}
                          />

                          <Field
                            label="Ceremony"
                            value={details.ceremony}
                            onChange={(value) => update("ceremony", value)}
                          />

                          <Field
                            label="Date"
                            value={details.date}
                            onChange={(value) => update("date", value)}
                          />

                          <Field
                            label="Time"
                            value={details.time}
                            onChange={(value) => update("time", value)}
                          />

                          <Field
                            label="Venue / address"
                            value={details.venue}
                            onChange={(value) => update("venue", value)}
                          />
                        </div>

                        <div className="mt-6 grid gap-4 border-t border-navy-950/10 pt-6 sm:grid-cols-3">
                          <Choice
                            label="Text position"
                            value={details.position}
                            onChange={(value) =>
                              update("position", value as TextPosition)
                            }
                            options={[
                              { value: "top", label: "At the top" },
                              { value: "bottom", label: "At the bottom" },
                            ]}
                          />

                          <Choice
                            label="Letter colour"
                            value={details.colour}
                            onChange={(value) =>
                              update(
                                "colour",
                                value as EditorState["colour"]
                              )
                            }
                            options={[
                              { value: "ivory", label: "Classic ivory" },
                              { value: "gold", label: "Elegant gold" },
                              { value: "ink", label: "Deep ink" },
                            ]}
                          />

                          <Choice
                            label="Heading size"
                            value={details.size}
                            onChange={(value) =>
                              update(
                                "size",
                                value as EditorState["size"]
                              )
                            }
                            options={[
                              { value: "regular", label: "Regular" },
                              { value: "large", label: "Large" },
                            ]}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {template && (
                  <TemplateExtras
                    look={template.look}
                    events={events}
                    captions={captions}
                    photoCount={photos.length}
                    onEvent={updateEvent}
                    onAdd={() =>
                      setEvents((current) =>
                        current.length < 4
                          ? [...current, { name: "", when: "" }]
                          : current
                      )
                    }
                    onRemove={(index) =>
                      setEvents((current) =>
                        current.filter((_, at) => at !== index)
                      )
                    }
                    onCaption={(index, value) =>
                      setCaptions((current) =>
                        current.map((line, at) =>
                          at === index ? value : line
                        )
                      )
                    }
                    onPhotos={chooseScenePhotos}
                  />
                )}

                <button
                  type="button"
                  onClick={() =>
                    template
                      ? applyTemplate(template)
                      : setDetails(DEFAULTS)
                  }
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy-700 underline underline-offset-4"
                >
                  <RotateCcw size={15} />
                  Reset lettering
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[.2em] text-gold-600">
                  Animated wedding film
                </p>

                <h2 className="mt-1 font-display text-2xl text-navy-950">
                  Create your reel
                </h2>

                <div className="mt-6 rounded-2xl border border-navy-950/10 bg-ivory-50 p-4 sm:p-5">
                  <h3 className="font-display text-xl text-navy-950">
                    AI video prompt
                  </h3>

                  <p className="mt-1 text-xs text-navy-700/60">
                    Your main prompt, wedding style and all selected scene
                    descriptions are combined here automatically. Edit
                    the main instructions directly in this box.
                  </p>

                  <textarea
                    value={combinedGenerationPrompt}
                    onChange={(event) =>
                      handleGenerationPromptChange(event.target.value)
                    }
                    rows={16}
                    maxLength={12000}
                    className="mt-3 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-3 text-sm leading-relaxed text-navy-950 focus:border-gold-500 focus:outline-none"
                    placeholder="Describe your wedding film..."
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setGenerationPrompt(STARTER_PROMPT);
                      setQuote(null);
                      setJob(null);
                    }}
                    className="mt-2 text-xs font-semibold text-navy-700 underline underline-offset-4"
                  >
                    Restore default prompt
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-navy-950/10 p-4 sm:p-5">
                  <h3 className="font-display text-xl text-navy-950">
                    Wedding invitation details
                  </h3>

                  <p className="mt-1 text-xs text-navy-700/60">
                    Enter only the names you want displayed in your invitation.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Bride name"
                      value={details.bride}
                      onChange={(value) => {
                        update("bride", value);
                        setQuote(null);
                      }}
                    />

                    <Field
                      label="Groom name"
                      value={details.groom}
                      onChange={(value) => {
                        update("groom", value);
                        setQuote(null);
                      }}
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-navy-950/10 p-4 sm:p-5">
                  <h3 className="font-display text-xl text-navy-950">
                    Text appearance
                  </h3>

                  <p className="mt-1 text-xs text-navy-700/60">
                    Choose how the complete invitation box appears in the preview.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Choice
                      label="Font style"
                      value={fontStyle}
                      onChange={(value) => {
                        setFontStyle(value);
                        setQuote(null);
                      }}
                      options={[
                        { value: "Elegant Script", label: "Elegant Script" },
                        { value: "Royal Serif", label: "Royal Serif" },
                        { value: "Classic Serif", label: "Classic Serif" },
                        { value: "Modern Minimal", label: "Modern Minimal" },
                        {
                          value: "Traditional Calligraphy",
                          label: "Traditional Calligraphy",
                        },
                      ]}
                    />

                    <Choice
                      label="Decorative text frame"
                      value={textDecoration}
                      onChange={(value) => {
                        setTextDecoration(value);
                        setQuote(null);
                      }}
                      options={[
                        { value: "Royal Frame", label: "Royal Frame" },
                        { value: "Floral Border", label: "Floral Border" },
                        {
                          value: "Elegant Background Box",
                          label: "Elegant Background Box",
                        },
                        {
                          value: "Classic Gold Border",
                          label: "Classic Gold Border",
                        },
                        { value: "No Frame", label: "No Frame" },
                      ]}
                    />

                    <Choice
                      label="Text position"
                      value={textPosition}
                      onChange={(value) => {
                        setTextPosition(value as TextPosition);
                        setQuote(null);
                      }}
                      options={[
                        { value: "top", label: "At the top" },
                        { value: "bottom", label: "At the bottom" },
                      ]}
                    />

                    <Choice
                      label="Video duration"
                      value={String(videoDuration)}
                      onChange={(value) => {
                        setVideoDuration(Number(value) as 5 | 10 | 15);
                        setQuote(null);
                      }}
                      options={[
                        { value: "5", label: "5 seconds" },
                        { value: "10", label: "10 seconds" },
                        { value: "15", label: "15 seconds" },
                      ]}
                    />
                  </div>
                </div>

                <p className="mt-3 text-sm text-navy-700/70">
                  Upload one couple photo, choose your wedding style
                  and select the ceremonies you want in your animated
                  wedding film. You can edit every scene before
                  generating your reel.
                </p>

                <div className="mt-6">
                  <label className="block text-sm font-semibold text-navy-950">
                    Wedding style
                  </label>

                  <select
                    value={weddingStyle}
                    onChange={(event) => {
                      setWeddingStyle(event.target.value);
                      setQuote(null);
                      setJob(null);
                      setGenerationError("");
                    }}
                    className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-3 text-sm text-navy-950 focus:border-gold-500 focus:outline-none"
                  >
                    <option value="">Choose your wedding style</option>

                    {WEDDING_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-navy-950">
                    Choose ceremonies for your video
                  </p>

                  <p className="mt-1 text-xs text-navy-700/60">
                    Select the moments you want included. Each selected
                    ceremony gets its own editable scene.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {CEREMONIES.map((ceremony) => {
                      const selected = weddingScenes.some(
                        (scene) => scene.ceremony === ceremony
                      );

                      return (
                        <button
                          key={ceremony}
                          type="button"
                          onClick={() => toggleWeddingCeremony(ceremony)}
                          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            selected
                              ? "border-navy-950 bg-navy-950 text-ivory-50"
                              : "border-navy-950/15 bg-white text-navy-700 hover:border-gold-500"
                          }`}
                        >
                          {selected ? "✓ " : "+ "}
                          {ceremony}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {weddingScenes.map((scene, index) => (
                  <div
                    key={scene.ceremony}
                    className="mt-5 rounded-2xl border border-navy-950/10 bg-ivory-50 p-4 sm:p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-gold-600">
                          Scene {index + 1}
                        </p>

                        <h3 className="mt-1 font-display text-xl text-navy-950">
                          {scene.ceremony}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleWeddingCeremony(scene.ceremony)}
                        aria-label={`Remove ${scene.ceremony}`}
                        className="grid h-9 w-9 place-items-center rounded-full border border-navy-950/10 bg-white text-navy-700"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4">
                      <label className="block text-xs font-semibold text-navy-700">
                        What happens in this scene?
                        <textarea
                          value={scene.description}
                          onChange={(event) =>
                            updateWeddingScene(
                              index,
                              "description",
                              event.target.value
                            )
                          }
                          rows={4}
                          maxLength={1500}
                          placeholder={`Describe what happens during ${scene.ceremony}...`}
                          className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-3 text-sm font-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                        />
                      </label>

                      <label className="block text-xs font-semibold text-navy-700">
                        Location (optional)
                        <input
                          value={scene.location}
                          onChange={(event) =>
                            updateWeddingScene(
                              index,
                              "location",
                              event.target.value
                            )
                          }
                          maxLength={500}
                          placeholder="e.g. Palace courtyard, Udaipur"
                          className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-xs font-semibold text-navy-700">
                          Date shown in reel
                          <input
                            value={scene.date}
                            onChange={(event) =>
                              updateWeddingScene(
                                index,
                                "date",
                                event.target.value
                              )
                            }
                            maxLength={50}
                            placeholder="e.g. 12 February"
                            className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                          />
                        </label>

                        <label className="block text-xs font-semibold text-navy-700">
                          Time shown in reel
                          <input
                            value={scene.time}
                            onChange={(event) =>
                              updateWeddingScene(
                                index,
                                "time",
                                event.target.value
                              )
                            }
                            maxLength={50}
                            placeholder="e.g. 7:30 PM"
                            className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                          />
                        </label>
                      </div>

                      <label className="block text-xs font-semibold text-navy-700">
                        Text shown for this ceremony
                        <input
                          value={scene.overlayText}
                          onChange={(event) =>
                            updateWeddingScene(
                              index,
                              "overlayText",
                              event.target.value
                            )
                          }
                          maxLength={300}
                          placeholder="Text displayed on the scene"
                          className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                        />
                      </label>

                      <label className="block text-xs font-semibold text-navy-700">
                        Bride outfit
                        <input
                          value={scene.brideOutfit}
                          onChange={(event) =>
                            updateWeddingScene(
                              index,
                              "brideOutfit",
                              event.target.value
                            )
                          }
                          maxLength={500}
                          placeholder="e.g. Traditional red Paithani saree with gold jewellery"
                          className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                        />
                      </label>

                      <label className="block text-xs font-semibold text-navy-700">
                        Groom outfit
                        <input
                          value={scene.groomOutfit}
                          onChange={(event) =>
                            updateWeddingScene(
                              index,
                              "groomOutfit",
                              event.target.value
                            )
                          }
                          maxLength={500}
                          placeholder="e.g. Cream sherwani with a traditional safa"
                          className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal text-navy-950 focus:border-gold-500 focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>
                ))}

                {weddingScenes.length === 0 && (
                  <p className="mt-5 rounded-xl border border-dashed border-navy-950/15 p-4 text-center text-sm text-navy-700/60">
                    Select at least one ceremony to start building
                    your wedding film.
                  </p>
                )}

                <label className="mt-6 grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed border-navy-950/20 bg-ivory-50 p-4 text-center">
                  {photoUrl ? (
                    <span className="relative block">
                      <img
                        src={photoUrl}
                        className="h-32 w-24 rounded-xl object-cover"
                        alt="Couple upload preview"
                      />

                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removePhoto();
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            removePhoto();
                          }
                        }}
                        className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-navy-950 text-white"
                        aria-label="Remove couple photo"
                      >
                        <X size={15} />
                      </span>
                    </span>
                  ) : (
                    <span>
                      <ImagePlus className="mx-auto text-gold-600" />

                      <b className="mt-2 block text-sm text-navy-950">
                        Upload a couple photo
                      </b>

                      <small className="mt-1 block text-navy-700/60">
                        JPG, PNG or WebP · under 3 MB
                      </small>
                    </span>
                  )}

                  <input
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    type="file"
                    onChange={choosePhoto}
                  />
                </label>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !photoData ||
                    !photoHash ||
                    !weddingStyle ||
                    weddingScenes.length === 0
                  }
                  onClick={reviewCost}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-950 px-5 py-3 text-sm font-semibold text-ivory-50 disabled:opacity-50"
                >
                  {busy ? "Reviewing…" : "Create your reel"}
                </button>

                {quote && (
                  <div className="mt-4 rounded-2xl bg-gold-500/10 p-4 text-sm text-navy-700">
                    <p>
                      <b className="text-navy-950">
                        Estimated xAI credits:{" "}
                        {estimatedCost !== null &&
                        Number.isFinite(estimatedCost)
                          ? `$${estimatedCost.toFixed(2)}`
                          : "Calculating"}
                      </b>{" "}
                      · {quote.seconds}s · {quote.resolution}
                    </p>

                    <p className="mt-1 text-xs">
                      Your photo is sent only after you confirm.
                      The actual provider charge is shown when xAI
                      returns it.
                    </p>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setQuote(null)}
                        className="rounded-full border border-navy-950/15 px-4 py-2 text-xs font-semibold"
                      >
                        Change
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={generate}
                        className="rounded-full bg-navy-950 px-4 py-2 text-xs font-semibold text-ivory-50"
                      >
                        {busy ? "Starting…" : "Confirm and generate"}
                      </button>
                    </div>
                  </div>
                )}

                {generationError && (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {generationError}
                  </p>
                )}

                {job && (
                  <div className="mt-4 rounded-2xl border border-navy-950/10 p-4 text-sm text-navy-700">
                    <b className="text-navy-950">
                      {job.state === "done"
                        ? "Video ready"
                        : job.state === "pending"
                          ? "Video is generating"
                          : "Generation update"}
                    </b>

                    {actualCost !== null &&
                      Number.isFinite(actualCost) && (
                        <p className="mt-1">
                          Actual xAI credits used: $
                          {actualCost.toFixed(2)}
                        </p>
                      )}

                    {job.error && (
                      <p className="mt-1 text-red-700">
                        {job.error}
                      </p>
                    )}

                    {job.videoUrl && (
                      <p className="mt-2">
                        <a
                          className="font-semibold underline"
                          href={job.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open generated MP4
                        </a>
                      </p>
                    )}

                    {["pending", "starting"].includes(job.state) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={checkProgress}
                        className="mt-3 rounded-full bg-navy-950 px-4 py-2 text-xs font-semibold text-ivory-50"
                      >
                        {busy ? "Checking…" : "Check progress"}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="lg:sticky lg:top-24">
            <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[.25em] text-navy-700/55">
              Live preview · 9:16
            </p>

            <div className="mx-auto max-w-[320px] overflow-hidden rounded-[32px] border-[7px] border-navy-950 bg-navy-950 shadow-2xl">
<div
  className="relative aspect-[9/16] overflow-hidden bg-navy-950"
  onMouseEnter={() => {
    if (!template) {
      void video.current?.play().catch(() => {});
    }
  }}
  onMouseLeave={() => {
    if (!template) {
      video.current?.pause();
    }
  }}
>                {template ? (
                  <TemplateReel
                    template={template}
                    details={details}
                    events={events}
                    captions={captions}
                    photos={photos}
                    paused={!isPlaying}
                  />
                ) : (
                  <>
                    <video
                      ref={video}
                      key={videoUrl}
                      src={videoUrl}
                      poster="/reels/wedding-reel-poster.jpg"
                      className="absolute inset-0 h-full w-full object-cover"
                      loop
                      playsInline
                      muted
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onTimeUpdate={(event) =>
                        setCurrentVideoTime(
                          event.currentTarget.currentTime
                        )
                      }
                      onLoadedMetadata={(event) => {
                        setActualVideoDuration(
                          event.currentTarget.duration || 0
                        );
                        setCurrentVideoTime(
                          event.currentTarget.currentTime
                        );
                      }}
                    />

                    {/* Complete invitation overlay for AI-generated videos. */}
                    {showOverlay && isGeneratedVideo && (
                      <div className={generatedOverlayClass}>
                        <div
                          className={`max-w-[92%] rounded-2xl px-4 py-4 text-center text-ivory-50 shadow-xl ${generatedFrameClass}`}
                          style={{
                            fontFamily: generatedFontFamily,
                          }}
                        >
                          <p className="text-xs uppercase tracking-[.2em] text-amber-200">
                            Wedding Invitation
                          </p>

                          <p className="mt-2 text-2xl leading-tight">
                            {details.bride} &amp; {details.groom}
                          </p>

                          <div className="mx-auto my-3 h-px w-16 bg-amber-300" />

                          <p className="text-base">
                            {activeWeddingScene?.overlayText ||
                              activeWeddingScene?.ceremony ||
                              "Wedding Ceremony"}
                          </p>

                          {activeWeddingScene?.date && (
                            <p className="mt-2 text-xs">
                              {activeWeddingScene.date}
                            </p>
                          )}

                          {activeWeddingScene?.time && (
                            <p className="mt-1 text-xs">
                              {activeWeddingScene.time}
                            </p>
                          )}

                          {activeWeddingScene?.location && (
                            <p className="mt-1 text-xs">
                              {activeWeddingScene.location}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Existing editable lettering for uploaded videos. */}
                    {showOverlay && !isGeneratedVideo && (
                      <div className={`${overlayClass} ${tone}`}>
                        <div
                          className={`max-w-[92%] rounded-xl px-3 py-2.5 ${shadow}`}
                        >
                          <p
                            className={`font-display leading-none ${
                              details.size === "large"
                                ? "text-3xl"
                                : "text-2xl"
                            }`}
                          >
                            {details.ceremony || "Wedding ceremony"}
                          </p>

                          <p className="mt-1 font-serif text-xs">
                            {details.bride} &amp; {details.groom}
                          </p>

                          <p className="mt-1 text-[10px]">
                            {details.date} · {details.time}
                          </p>

                          <p className="mt-1 text-[10px]">
                            {details.venue}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mx-auto mt-4 flex max-w-[320px] gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-navy-950 px-4 py-2.5 text-sm font-semibold text-ivory-50"
              >
                {isPlaying ? (
                  <Pause size={15} />
                ) : (
                  <Play size={15} />
                )}

                {isPlaying ? "Pause" : "Play"}
              </button>

              <Link
                href="/wedding/reels"
                className="inline-flex items-center justify-center rounded-full border border-navy-950/15 px-4 text-sm font-semibold text-navy-700"
              >
                Templates
              </Link>
            </div>

            {/* Render and download the final MP4 with burned-in text. */}
            {isGeneratedVideo && (
              <div className="mx-auto mt-4 max-w-[320px]">
                <button
                  type="button"
                  disabled={isRendering}
                  onClick={downloadRenderedVideo}
                  className="w-full rounded-full bg-gold-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gold-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRendering
                    ? `Rendering MP4… ${renderProgress}%`
                    : "Render & Download MP4"}
                </button>

                {isRendering && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy-950/10">
                    <div
                      className="h-full rounded-full bg-gold-500 transition-all"
                      style={{ width: `${renderProgress}%` }}
                    />
                  </div>
                )}

                {renderError && (
                  <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                    {renderError}
                  </p>
                )}

                <p className="mt-2 text-center text-xs text-navy-700/60">
                  Your selected font, frame and invitation details will
                  be permanently added to the downloaded MP4.
                </p>
              </div>
            )}

            {isGeneratedVideo && (
              <p className="mx-auto mt-3 max-w-[320px] text-center text-xs text-navy-700/60">
                Font, frame and position changes are shown in this preview.
              </p>
            )}

            <p className="mx-auto mt-4 max-w-[320px] text-center text-xs leading-relaxed text-navy-700/60">
              <Music2 className="mr-1 inline" size={13} />
              Keep the original video soundtrack when you upload
              an existing reel. Music/export can be added with the
              production render service.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">
      {label}

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-navy-950/15 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-navy-950 focus:border-gold-500 focus:outline-none"
      />
    </label>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">
      {label}

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-navy-950/15 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-navy-950 focus:border-gold-500 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Editors that animated templates need: ceremonies, subtitles and scene photos. */
function TemplateExtras({
  look,
  events,
  captions,
  photoCount,
  onEvent,
  onAdd,
  onRemove,
  onCaption,
  onPhotos,
}: {
  look: string;
  events: ReelEvent[];
  captions: string[];
  photoCount: number;
  onEvent: (
    index: number,
    key: keyof ReelEvent,
    value: string
  ) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onCaption: (index: number, value: string) => void;
  onPhotos: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const input =
    "w-full rounded-xl border border-navy-950/15 px-3 py-2 text-sm text-navy-950 focus:border-gold-500 focus:outline-none";

  return (
    <div className="mt-6 border-t border-navy-950/10 pt-6">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">
        Ceremonies in the reel
      </p>

      <div className="mt-2 grid gap-2">
        {events.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_1fr_auto] gap-2"
          >
            <input
              aria-label={`Ceremony ${index + 1}`}
              value={item.name}
              onChange={(event) =>
                onEvent(index, "name", event.target.value)
              }
              placeholder="Haldi"
              className={input}
            />

            <input
              aria-label={`Ceremony ${index + 1} date and time`}
              value={item.when}
              onChange={(event) =>
                onEvent(index, "when", event.target.value)
              }
              placeholder="22 Feb · 10 AM"
              className={input}
            />

            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove ceremony ${index + 1}`}
              className="grid w-10 place-items-center rounded-xl border border-navy-950/10 text-navy-700"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {events.length < 4 && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-navy-700"
        >
          <Plus size={15} />
          Add ceremony
        </button>
      )}

      {look === "ghar" && (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[.12em] text-navy-700/70">
            Story subtitles
          </p>

          <div className="mt-2 grid gap-2">
            {captions.map((line, index) => (
              <input
                key={index}
                aria-label={`Subtitle ${index + 1}`}
                value={line}
                onChange={(event) =>
                  onCaption(index, event.target.value)
                }
                className={input}
              />
            ))}
          </div>
        </>
      )}

      {look === "cinema" && (
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-navy-950/20 bg-ivory-50 px-4 py-3 text-sm text-navy-700">
          <span>
            <b className="block text-navy-950">Scene photos</b>
            {photoCount
              ? `${photoCount} photo${photoCount > 1 ? "s" : ""} in the reel`
              : "Up to 4 photos, one per scene"}
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-navy-950 px-3 py-1.5 text-xs font-semibold text-ivory-50">
            <ImagePlus size={14} />
            Choose
          </span>

          <input
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={onPhotos}
          />
        </label>
      )}
    </div>
  );
}
