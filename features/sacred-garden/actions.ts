"use server";

import { cookies } from "next/headers";

import { requireDraftEvent } from "@/features/start/draft-auth";
import { nextWizardStep, wizardStepHref } from "@/features/start/wizard-steps";
import { cleanDesign } from "@/features/sacred-garden/lib/design";
import { REF_COOKIE } from "@/lib/constants";
import { SEGMENT_COPY } from "@/lib/event-segment";
import { isValidSlug } from "@/lib/slug";
import { DEFAULT_EVENT_TIMEZONE, zonedInputValueToUtcIso } from "@/lib/timezone";
import { createDraftEvent, getDraftEventByToken } from "@/services/event-drafts";
import { updateEvent } from "@/services/events";
import { assertTemplateAllowed } from "@/services/template-access";
import { createSignedDesignMediaUpload, UploadValidationError } from "@/services/uploads";

/**
 * The Sacred Garden create page (/wedding-websites/create) publishes into
 * an ordinary wizard draft event: the couple's whole form is kept in
 * events.design_config, the names/date/venue go into the event's own
 * columns. It is the wizard's Design step for weddings (app/start/[token]/design),
 * and from the standalone page Publish starts a wedding draft and carries on in
 * the wizard — the website goes live through Review (account + plan) like any other. As everywhere in the
 * wizard, the draft token is the credential and is re-resolved each call.
 */

type Result<T> = { success: true; data: T } | { success: false; error: string };

const TEMPLATE = "sacred-garden";
/** Hours a wedding without an end time is assumed to last (for "has it ended?" checks). */
const DEFAULT_HOURS = 5;

const fail = (err: unknown, fallback: string): { success: false; error: string } => ({
  success: false,
  error: err instanceof UploadValidationError || err instanceof Error ? err.message : fallback,
});

/** The draft this design publishes into: the one from the wizard link, else a new wedding draft. */
export async function startWeddingDraftAction(token: string | null): Promise<Result<{ token: string }>> {
  try {
    if (token && (await getDraftEventByToken(token))) return { success: true, data: { token } };
    const referredByCode = (await cookies()).get(REF_COOKIE)?.value ?? null;
    const draft = await createDraftEvent(referredByCode, "family");
    await updateEvent(draft.id, { category: "wedding", templateSlug: TEMPLATE, wizardGoals: ["website"] });
    return { success: true, data: { token: draft.token } };
  } catch (err) {
    return fail(err, "Your website could not be started. Please try again.");
  }
}

/** A signed upload for one picture, video or music file of the design. */
export async function requestWeddingMediaUploadAction(
  token: string,
  kind: "image" | "video" | "audio",
  contentType: string,
  fileSize: number,
): Promise<Result<{ bucket: string; path: string; uploadToken: string; contentType: string; ref: string }>> {
  try {
    const event = await requireDraftEvent(token);
    if (!["image", "video", "audio"].includes(kind)) return { success: false, error: "Unsupported file." };
    const signed = await createSignedDesignMediaUpload({ eventId: event.id, kind, contentType, fileSize });
    return {
      success: true,
      data: { bucket: signed.bucket, path: signed.path, uploadToken: signed.token, contentType: signed.contentType, ref: `media:${signed.bucket}/${signed.path}` },
    };
  } catch (err) {
    return fail(err, "The file could not be uploaded.");
  }
}

/** Saves the design on the draft and returns the wizard step after Design to continue at. */
export async function saveWeddingDesignAction(token: string, form: unknown): Promise<Result<{ href: string }>> {
  try {
    const event = await requireDraftEvent(token);
    const design = cleanDesign(form, event.id);
    const groom = design.groom || "Groom";
    const bride = design.bride || "Bride";
    const date = design.date ?? "";
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) return { success: false, error: "Pick the wedding date and time." };
    const startAt = zonedInputValueToUtcIso(date, event.timezone || DEFAULT_EVENT_TIMEZONE);
    if (Number.isNaN(new Date(startAt).getTime())) return { success: false, error: "Pick the wedding date and time." };

    await assertTemplateAllowed(event.id, TEMPLATE, event.templateSlug);
    const goals = Array.from(new Set([...(event.wizardGoals ?? []), "website"]));
    const slug = (design.slug ?? "").toLowerCase();
    if (slug && !isValidSlug(slug)) return { success: false, error: "Use 3–80 small letters, numbers or single dashes for the link, for example kunal-aanchal." };
    await updateEvent(event.id, {
      category: "wedding",
      templateSlug: TEMPLATE,
      honoreeName: `${groom} & ${bride}`,
      eventTitle: event.category === "wedding" && event.eventTitle !== SEGMENT_COPY.family.draftEventTitle ? event.eventTitle : "Wedding",
      startAt,
      endAt: new Date(new Date(startAt).getTime() + DEFAULT_HOURS * 60 * 60 * 1000).toISOString(),
      hasEndTime: false,
      venueName: design.venueName || null,
      venueAddress: design.venueAddress || null,
      dressCode: design.dress || null,
      wizardGoals: goals,
      designConfig: design,
      ...(slug && slug !== event.slug ? { slug } : {}),
    });
    // on to the wizard step after Design (RSVP Form, …)
    return { success: true, data: { href: wizardStepHref(token, nextWizardStep("design", goals, "wedding")?.slug ?? "review") } };
  } catch (err) {
    return fail(err, "Your website could not be saved.");
  }
}
