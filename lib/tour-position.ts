export interface TourRect { top: number; left: number; width: number; height: number }

/** Keep controls reachable even when a target is missing or outside the viewport. */
export function tourPosition(rect: TourRect | null, viewportWidth: number, viewportHeight: number, cardHeight = 280) {
  const margin = 16;
  const width = Math.max(0, Math.min(360, viewportWidth - margin * 2));
  const height = Math.min(cardHeight, Math.max(0, viewportHeight - margin * 2));
  const left = Math.max(margin, Math.min(rect?.left ?? (viewportWidth - width) / 2, viewportWidth - width - margin));
  const below = rect ? rect.top + rect.height + 12 : (viewportHeight - height) / 2;
  const desiredTop = rect && below + height > viewportHeight - margin ? rect.top - height - 12 : below;
  const top = Math.max(margin, Math.min(desiredTop, viewportHeight - height - margin));
  return { left, top, width, maxHeight: Math.max(0, viewportHeight - margin * 2) };
}
