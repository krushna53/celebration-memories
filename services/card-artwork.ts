import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/services/uploads";

/**
 * The invitation card's main illustration, cropped out of the uploaded
 * card (events.share_image_path) using the box the card reader returned
 * (lib/ai-invitation-card-reader.ts → `artwork`) — or uploaded by the
 * host — stored as events.card_artwork_path and shown under the hero
 * title (features/hero/hero-section.tsx `artworkUrl`).
 *
 * Reads degrade to null on any error, so a page never breaks over it.
 */
export interface ArtworkBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BUCKET = "gallery";

/** Clamps a 0–1 box, adds a little breathing room, and rejects boxes too small/large to be an illustration. */
function normaliseBox(box: ArtworkBox): ArtworkBox | null {
  if (![box.x, box.y, box.width, box.height].every((n) => Number.isFinite(n))) return null;
  const pad = 0.015;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const width = Math.min(1 - x, box.width + pad * 2);
  const height = Math.min(1 - y, box.height + pad * 2);
  if (width < 0.12 || height < 0.08) return null;
  if (width > 0.98 && height > 0.98) return null; // the whole card — nothing to crop
  return { x, y, width, height };
}

export async function getCardArtworkUrl(eventId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select("card_artwork_path")
      .eq("id", eventId)
      .maybeSingle<{ card_artwork_path: string | null }>();
    if (error || !data?.card_artwork_path) return null;
    return publicMediaUrl(BUCKET, data.card_artwork_path);
  } catch {
    return null;
  }
}

async function currentPath(eventId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("events").select("card_artwork_path").eq("id", eventId).maybeSingle<{ card_artwork_path: string | null }>();
  return data?.card_artwork_path ?? null;
}

/** Crops the artwork out of the event's card image and saves it, replacing any previous one. Returns false if the box isn't usable. */
export async function saveCardArtworkFromCard(eventId: string, cardPath: string, box: ArtworkBox): Promise<boolean> {
  if (!cardPath.startsWith(`${eventId}/`) || cardPath.includes("..")) throw new Error("That card doesn't belong to this event.");
  const area = normaliseBox(box);
  if (!area) return false;

  const client = supabaseAdmin();
  const { data: file, error: downloadError } = await client.storage.from(BUCKET).download(cardPath);
  if (downloadError || !file) throw new Error("Couldn't open the invitation card.");

  const oriented = await sharp(Buffer.from(await file.arrayBuffer())).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(oriented).metadata();
  if (!width || !height) throw new Error("Couldn't read the invitation card image.");

  const left = Math.round(area.x * width);
  const top = Math.round(area.y * height);
  const cropWidth = Math.min(width - left, Math.round(area.width * width));
  const cropHeight = Math.min(height - top, Math.round(area.height * height));
  if (cropWidth < 40 || cropHeight < 40) return false;

  const output = await sharp(oriented)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();

  const path = `${eventId}/card-artwork/${randomUUID()}.webp`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, output, { contentType: "image/webp" });
  if (uploadError) throw new Error(`Couldn't save the illustration: ${uploadError.message}`);

  const previous = await currentPath(eventId);
  const { error } = await client.from("events").update({ card_artwork_path: path }).eq("id", eventId);
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  if (previous && previous !== path) await client.storage.from(BUCKET).remove([previous]);
  return true;
}

export async function removeCardArtwork(eventId: string): Promise<void> {
  const previous = await currentPath(eventId);
  const { error } = await supabaseAdmin().from("events").update({ card_artwork_path: null }).eq("id", eventId);
  if (error) throw new Error(error.message);
  if (previous) await supabaseAdmin().storage.from(BUCKET).remove([previous]);
}

/**
 * Points the event at a banner image the host uploaded themselves
 * (createSignedCardArtworkUpload). The path must be in this event's own
 * card-artwork folder and the file must actually exist.
 */
export async function setUploadedCardArtwork(eventId: string, path: string): Promise<string> {
  const folder = `${eventId}/card-artwork/`;
  if (!path.startsWith(folder) || path.includes("..") || path.slice(folder.length).includes("/")) {
    throw new Error("That upload doesn't belong to this event.");
  }
  const client = supabaseAdmin();
  const { data: listed, error: listError } = await client.storage.from(BUCKET).list(`${eventId}/card-artwork`, { search: path.slice(folder.length) });
  if (listError || !listed?.some((f) => `${folder}${f.name}` === path)) throw new Error("The upload didn't finish — please try again.");

  const previous = await currentPath(eventId);
  const { error } = await client.from("events").update({ card_artwork_path: path }).eq("id", eventId);
  if (error) throw new Error(error.message);
  if (previous && previous !== path) await client.storage.from(BUCKET).remove([previous]);
  return publicMediaUrl(BUCKET, path);
}
