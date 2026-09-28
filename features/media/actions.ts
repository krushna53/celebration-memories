"use server";

import { externalizeMediaLink } from "@/services/external-media";

const MAX_LINKS = 300;

/**
 * Turns the signed `/media/...` links a page was given into direct
 * Supabase signed URLs that an outside renderer (Shotstack, HeyGen) can
 * fetch — called by the slideshow and timeline-movie hooks right before
 * they start a render. No admin check on purpose: the /start wizard uses
 * the same hooks before the host has an account. It's safe without one
 * because every link must carry a genuine, unexpired signature, so a
 * caller only ever gets a longer-lived link to a file they could already
 * see. Anything that isn't a media link (null, YouTube, etc.) passes
 * through unchanged.
 */
export async function externalizeMediaLinksAction(
  links: (string | null)[],
): Promise<{ success: true; data: (string | null)[] } | { success: false; error: string }> {
  if (!Array.isArray(links) || links.length > MAX_LINKS) {
    return { success: false, error: "Too many files in one render." };
  }
  try {
    const data = await Promise.all(links.map((l) => (typeof l === "string" && l ? externalizeMediaLink(l) : l)));
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Couldn't prepare your photos for rendering — please reload and try again.",
    };
  }
}
