import ModernOpening from "./ModernOpening";

/**
 * A small drawing of a sample's opening for its card on /wedding/webpages — every envelope, curtain and door is
 * drawn its own way, and hovering the card plays a hint of the real opening.
 * colours: cloth / door / paper, its shadow, the gold work, and the page background.
 */
export function OpeningThumb({ style, cloth, shade, trim, bg, initials }: { style: string; cloth: string; shade: string; trim: string; bg: string; initials: string }) {
  const envelope = ["film", "seal", "pocket", "gatefold", "lasercut", "airmail", "ribbon", "photo-envelope"].includes(style);
  const gate = ["temple", "jali", "haveli", "glass", "sage", "monogram", "photo-haveli", "photo-palace"].includes(style);
  const family = envelope ? "envelope" : gate ? "gate" : "drape";
  // a thumbnail: no date, and nothing to run on open (it opens on hover, never for real)
  return <ModernOpening family={family} colors={{ main: bg, dark: shade, trim, ink: cloth }} monogram={initials} names="" date="" onOpen={undefined} onDone={undefined} thumb play />;
}

/** Put on the card's link so hovering anywhere on the card plays the thumbnail. */
export const thumbHost = "";
