/**
 * Tiny, dependency-free colour helpers for building template palettes at
 * render time (lib/template-theme-vars.ts) — hex parsing, mixing, and
 * WCAG relative-luminance contrast. Server- and client-safe.
 */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

function toRgb(hex: string): [number, number, number] {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** `amount` 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex([0, 1, 2].map((i) => ra[i]! + (rb[i]! - ra[i]!) * amount) as [number, number, number]);
}

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function isLight(hex: string): boolean {
  // Midpoint where white and black text have equal contrast.
  return luminance(hex) > 0.179;
}

/**
 * Nudges `color` toward white or black (whichever side `background`
 * isn't on) until it reaches `minRatio` against `background` — keeps a
 * template's accent hue while guaranteeing it stays readable.
 */
export function ensureContrast(color: string, background: string, minRatio: number): string {
  if (contrast(color, background) >= minRatio) return color;
  const target = isLight(background) ? "#000000" : "#ffffff";
  for (let step = 1; step <= 10; step++) {
    const candidate = mix(color, target, step / 10);
    if (contrast(candidate, background) >= minRatio) return candidate;
  }
  return target;
}
