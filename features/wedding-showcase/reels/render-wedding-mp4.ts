
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

type RenderScene = {
  ceremony?: string;
  overlayText?: string;
  date?: string;
  time?: string;
  location?: string;
};

type WeddingRenderOptions = {
  bride: string;
  groom: string;
  scenes: RenderScene[];
  fontStyle: string;
  textDecoration: string;
  textPosition: "top" | "bottom";
};

const FONT_FAMILIES: Record<string, string> = {
  "Elegant Script": '"Brush Script MT", "Segoe Script", cursive',
  "Royal Serif": "Georgia, serif",
  "Classic Serif": '"Times New Roman", serif',
  "Modern Minimal": "Arial, sans-serif",
  "Traditional Calligraphy": '"Palatino Linotype", "Book Antiqua", serif',
};

function safeText(value: string | undefined | null): string {
  return value?.trim() ?? "";
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;

    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY, maxWidth);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, currentY, maxWidth);
  }
}

function drawInvitation(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  timestamp: number,
  duration: number,
  options: WeddingRenderOptions
) {
  const scenes = options.scenes ?? [];
  const safeScenes: RenderScene[] = scenes.length
    ? scenes
    : [{ ceremony: "Wedding Ceremony" }];

  const sceneDuration = duration / safeScenes.length;

  const sceneIndex = Math.min(
    safeScenes.length - 1,
    Math.max(0, Math.floor(timestamp / Math.max(sceneDuration, 0.001)))
  );

  const scene = safeScenes[sceneIndex] ?? safeScenes[0] ?? {};

  const bride = safeText(options.bride);
  const groom = safeText(options.groom);
  const ceremony = safeText(scene.overlayText) || safeText(scene.ceremony);
  const date = safeText(scene.date);
  const time = safeText(scene.time);
  const location = safeText(scene.location);

  const topPosition = options.textPosition === "top";
  const centerX = width / 2;
  const boxWidth = width * 0.86;
  const boxHeight = Math.min(height * 0.35, 420);
  const boxX = (width - boxWidth) / 2;
  const boxY = topPosition
    ? height * 0.045
    : height - boxHeight - height * 0.045;

  const fontFamily =
    FONT_FAMILIES[options.fontStyle] ??
    FONT_FAMILIES["Elegant Script"];

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (options.textDecoration !== "No Frame") {
    ctx.fillStyle =
      options.textDecoration === "Elegant Background Box"
        ? "rgba(12, 20, 39, 0.78)"
        : "rgba(12, 20, 39, 0.62)";

    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 22);
    ctx.fill();

    if (options.textDecoration === "Royal Frame") {
      ctx.strokeStyle = "#e9c77b";
      ctx.lineWidth = 8;
      ctx.strokeRect(boxX + 8, boxY + 8, boxWidth - 16, boxHeight - 16);

      ctx.strokeStyle = "#f7e6b8";
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX + 20, boxY + 20, boxWidth - 40, boxHeight - 40);
    } else if (options.textDecoration === "Floral Border") {
      ctx.strokeStyle = "#f4c6d7";
      ctx.lineWidth = 5;
      ctx.setLineDash([5, 10]);
      ctx.strokeRect(boxX + 10, boxY + 10, boxWidth - 20, boxHeight - 20);
      ctx.setLineDash([]);
    } else if (options.textDecoration === "Classic Gold Border") {
      ctx.strokeStyle = "#d9ad55";
      ctx.lineWidth = 5;
      ctx.strokeRect(boxX + 10, boxY + 10, boxWidth - 20, boxHeight - 20);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4);
    }
  }

  const innerWidth = boxWidth - 56;
  let y = boxY + 48;

  ctx.fillStyle = "#e9c77b";
  ctx.font = `600 ${Math.round(width * 0.027)}px Arial, sans-serif`;
  ctx.fillText("WEDDING INVITATION", centerX, y);

  y += 55;
  ctx.fillStyle = "#fffaf0";
  ctx.font = `bold ${Math.round(width * 0.064)}px ${fontFamily}`;

  drawWrappedText(
    ctx,
    `${bride} & ${groom}`,
    centerX,
    y,
    innerWidth,
    Math.round(width * 0.075)
  );

  y += 65;
  ctx.fillStyle = "#e9c77b";
  ctx.fillRect(centerX - 42, y, 84, 2);
  y += 32;

  if (ceremony) {
    ctx.fillStyle = "#fffaf0";
    ctx.font = `500 ${Math.round(width * 0.034)}px ${fontFamily}`;
    drawWrappedText(ctx, ceremony, centerX, y, innerWidth, 34);
    y += 42;
  }

  ctx.fillStyle = "#fffaf0";
  ctx.font = `${Math.round(width * 0.027)}px Arial, sans-serif`;

  if (date) {
    ctx.fillText(date, centerX, y, innerWidth);
    y += 30;
  }

  if (time) {
    ctx.fillText(time, centerX, y, innerWidth);
    y += 30;
  }

  if (location) {
    drawWrappedText(ctx, location, centerX, y, innerWidth, 26);
  }

  ctx.restore();
}

export async function renderWeddingMp4(
  sourceUrl: string,
  options: WeddingRenderOptions,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  // sourceUrl is now a same-origin local URL supplied by the API proxy.
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error("Could not download the generated video for rendering.");
  }

  const sourceBlob = await response.blob();

  if (!sourceBlob.size) {
    throw new Error("The generated video file is empty.");
  }

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(sourceBlob),
  });

  const target = new BufferTarget();

  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  const duration = await input.computeDuration();

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not read the video duration.");
  }

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      forceTranscode: true,
      codec: "avc",
      process: (sample) => {
        const width = sample.displayWidth;
        const height = sample.displayHeight;

        if (!width || !height) {
          throw new Error("Could not read the video dimensions.");
        }

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not create the video rendering canvas.");
        }

        sample.draw(ctx, 0, 0);

        drawInvitation(
          ctx,
          width,
          height,
          sample.timestamp,
          duration,
          options
        );

        return canvas;
      },
    },
  });

  conversion.onProgress = (progress) => {
    if (typeof progress === "number") {
      onProgress?.(Math.round(progress * 100));
    }
  };

  if (!conversion.isValid) {
    throw new Error(
      "This browser cannot render the video in MP4 format. Try the latest Chrome or Edge."
    );
  }

  await conversion.execute();

  if (!target.buffer) {
    throw new Error("The final MP4 could not be created.");
  }

  onProgress?.(100);

  return new Blob([target.buffer], {
    type: "video/mp4",
  });
}
