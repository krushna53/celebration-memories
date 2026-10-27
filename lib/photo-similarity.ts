/**
 * Look-alike photo detection on perceptual hashes (64-bit dHash as 16 hex
 * chars, computed by services/photo-hashes.ts). Pure — no I/O — so the Big
 * Screen's slide builder and the admin "Similar photos" panel share it.
 */

/** Bits that may differ for two photos to count as "the same picture": re-encoded, resized, or a near-identical burst shot. */
export const SIMILAR_MAX_DISTANCE = 6;

/** Marks a file that couldn't be hashed, so it isn't retried. */
export const UNHASHABLE = "-";

const HASH = /^[0-9a-f]{16}$/;

export function isPhotoHash(value: string | null | undefined): value is string {
  return typeof value === "string" && HASH.test(value);
}

/** Number of differing bits between two hashes. */
export function hashDistance(a: string, b: string): number {
  // Two 32-bit halves — bitwise ops in JS are 32-bit.
  return popCount(parseInt(a.slice(0, 8), 16) ^ parseInt(b.slice(0, 8), 16)) + popCount(parseInt(a.slice(8), 16) ^ parseInt(b.slice(8), 16));
}

function popCount(x: number): number {
  let bits = 0;
  for (let v = x >>> 0; v; v >>>= 1) bits += v & 1;
  return bits;
}

/**
 * Groups items whose hashes are within SIMILAR_MAX_DISTANCE of a group's
 * first item, keeping input order. Items without a hash are each their own
 * group, so nothing unhashed is ever hidden.
 */
export function groupSimilar<T>(items: T[], hashOf: (item: T) => string | null | undefined): T[][] {
  const groups: { hash: string | null; items: T[] }[] = [];
  for (const item of items) {
    const hash = hashOf(item);
    const match = isPhotoHash(hash)
      ? groups.find((g) => g.hash !== null && hashDistance(g.hash, hash) <= SIMILAR_MAX_DISTANCE)
      : undefined;
    if (match) match.items.push(item);
    else groups.push({ hash: isPhotoHash(hash) ? hash : null, items: [item] });
  }
  return groups.map((g) => g.items);
}

/**
 * The Big Screen's rule (lib/build-display-slides.ts): every `pinned` photo
 * (a Timeline milestone's cover — it carries the milestone's story) is
 * shown; any other photo that looks like a pinned one or like an earlier
 * shown photo is skipped. Returns the keys to skip, in input order.
 */
export function similarRepeats(items: { key: string; hash?: string | null; pinned?: boolean }[]): Set<string> {
  const shown = items.flatMap((item) => (item.pinned && isPhotoHash(item.hash) ? [item.hash] : []));
  const repeats = new Set<string>();
  for (const item of items) {
    if (item.pinned || !isPhotoHash(item.hash)) continue;
    const hash = item.hash;
    if (shown.some((other) => hashDistance(other, hash) <= SIMILAR_MAX_DISTANCE)) repeats.add(item.key);
    else shown.push(hash);
  }
  return repeats;
}

/** Every Gallery and Timeline photo in Big Screen order, for similarRepeats. Gallery photos are keyed `gallery-<id>`, Timeline ones `timeline-<milestoneId>-<cover|photoId>`. */
export function displayPhotoOrder(
  galleryPhotos: { id: string; url: string; phash?: string | null }[],
  milestones: { id: string; imageUrl: string | null; imagePhash?: string | null; photos?: { id: string; phash?: string | null }[] }[],
): { key: string; hash?: string | null; pinned?: boolean }[] {
  return [
    ...galleryPhotos.map((photo) => ({ key: `gallery-${photo.id}`, hash: photo.phash })),
    ...milestones.flatMap((m) => [
      ...(m.imageUrl ? [{ key: `timeline-${m.id}-cover`, hash: m.imagePhash, pinned: true }] : []),
      ...(m.photos ?? []).map((photo) => ({ key: `timeline-${m.id}-${photo.id}`, hash: photo.phash })),
    ]),
  ];
}
