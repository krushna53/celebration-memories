"use server";

import { revalidatePath } from "next/cache";

import {
  createPublicMemoryUploader,
  getEventForPublicMemories,
  renamePublicMemoryUploader,
} from "@/services/public-memories";

export type IdentifyPublicMemoryUploaderResult =
  | { success: true; token: string; firstName: string }
  | { success: false; error: string };

/**
 * Server Action backing the public "share a memory" page
 * (/events/[slug]/memories). Re-checks server-side that the event has
 * opted into public memory uploads (never trusts the client), then mints
 * a fresh invitee + token via createPublicMemoryUploader so the visitor
 * can drop straight into the normal <MediaUploadsSection token={...} />
 * flow — same upload actions, same approval queue, same Memory Wall as a
 * personal /invite/[token] link.
 *
 * `honeypot` is a hidden field real visitors never see or fill in — if
 * it comes back non-empty, a bot filled the form, so this quietly
 * reports success without creating anything. This page has no secret
 * token gating it, so it needs the same light spam guard as the public
 * RSVP page (see features/rsvp/public-rsvp-actions.ts).
 */
export async function identifyPublicMemoryUploaderAction(
  eventSlug: string,
  name: string,
  honeypot?: string,
): Promise<IdentifyPublicMemoryUploaderResult> {
  if (honeypot) {
    return { success: true, token: "", firstName: name.trim().split(" ")[0] || "there" };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Please enter your name." };
  }
  if (trimmed.length > 100) {
    return { success: false, error: "That name looks too long — please shorten it." };
  }

  const event = await getEventForPublicMemories(eventSlug);
  if (!event) {
    return { success: false, error: "This link isn't open for memory uploads." };
  }

  try {
    const invitee = await createPublicMemoryUploader(event.id, trimmed);
    revalidatePath(`/events/${eventSlug}/memories`);
    return { success: true, token: invitee.token, firstName: trimmed.split(" ")[0] || trimmed };
  } catch (err) {
    console.error("identifyPublicMemoryUploaderAction failed:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export type RenamePublicMemoryUploaderResult = { success: true } | { success: false; error: string };

/**
 * Fills in a real name on an already-identified public memory
 * uploader — see renamePublicMemoryUploader's doc comment for why this
 * exists (video actions require a real name; other actions don't, so a
 * guest can hit this gap after already identifying with a blank name).
 * Re-resolves the invitee from the token itself, never trusts anything
 * else the client sends.
 */
export async function renamePublicMemoryUploaderAction(
  token: string,
  name: string,
): Promise<RenamePublicMemoryUploaderResult> {
  try {
    await renamePublicMemoryUploader(token, name);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
