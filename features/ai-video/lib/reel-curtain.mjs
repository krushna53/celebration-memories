// Theatre-style curtain reveal drawn on top of a clip (used for the opening). progress 0 = closed, 1 = fully open.
export const CURTAIN_STYLES = { royal: "Royal red and gold", ivory: "Ivory with marigolds", none: "No curtains" };
export function curtainProgress(seconds, hold = 0.4, open = 2.2) {
  const p = Math.min(1, Math.max(0, (seconds - hold) / open));
  return p * p * (3 - 2 * p);
}
export function drawCurtainReveal(ctx, width, height, progress, style = "royal") {
  if (style === "none" || progress >= 1) return;
  const royal = style !== "ivory";
  const half = width / 2, shift = half * progress * 1.05;
  ctx.save();
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -shift : half + shift, g = ctx.createLinearGradient(x0, 0, x0 + half, 0);
    const folds = 6;
    for (let i = 0; i <= folds; i++) {
      const t = i / folds, dark = i % 2 === 0;
      g.addColorStop(t, royal ? (dark ? "#5c0a12" : "#9e1b26") : (dark ? "#e8dcc4" : "#fbf5ea"));
    }
    ctx.fillStyle = g; ctx.fillRect(x0, 0, half, height);
    // gold edge where the two curtains meet
    const edge = side < 0 ? x0 + half - 10 : x0;
    ctx.fillStyle = royal ? "#d4a648" : "#c9a24a"; ctx.fillRect(edge, 0, 10, height);
    // tassel rope
    ctx.fillStyle = royal ? "#e7c06a" : "#b8862f";
    const ropeX = side < 0 ? x0 + half * 0.55 : x0 + half * 0.45;
    ctx.beginPath(); ctx.arc(ropeX, height * 0.55, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(ropeX - 4, height * 0.55, 8, 60);
    if (!royal) {
      // hanging marigold strings
      for (let s = 0; s < 3; s++) {
        const sx = x0 + half * (0.2 + s * 0.3);
        for (let y = 20; y < height * 0.45; y += 26) { ctx.fillStyle = y % 52 ? "#f2a71b" : "#e8590c"; ctx.beginPath(); ctx.arc(sx, y, 9, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }
  // top valance with scallops, stays until the curtains are mostly open
  const valance = 120 * (1 - progress * 0.8);
  ctx.fillStyle = royal ? "#7a0f19" : "#efe3cc"; ctx.fillRect(0, 0, width, valance);
  ctx.fillStyle = royal ? "#d4a648" : "#c9a24a";
  for (let x = 0; x < width; x += 60) { ctx.beginPath(); ctx.arc(x + 30, valance, 30, 0, Math.PI); ctx.fill(); }
  ctx.restore();
}
