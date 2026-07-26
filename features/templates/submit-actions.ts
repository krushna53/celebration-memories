"use server";

import { createTemplateSubmission } from "@/services/template-submissions";
import { templateSubmissionFormSchema, type TemplateSubmissionFormValues } from "@/types/template-submission";

export type SubmitTemplateResult = { success: true } | { success: false; error: string };

/**
 * Server Action backing the public template-submission form
 * (/templates/submit). Anyone can submit — no account needed — so this
 * has the same honeypot guard as the public RSVP form
 * (features/rsvp/public-rsvp-actions.ts): a hidden field real people
 * never fill in, and a non-empty value quietly reports success without
 * writing anything.
 */
export async function submitTemplateAction(
  values: TemplateSubmissionFormValues,
  honeypot?: string,
): Promise<SubmitTemplateResult> {
  if (honeypot) {
    return { success: true };
  }

  const parsed = templateSubmissionFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Please check the form and try again." };
  }

  try {
    await createTemplateSubmission({
      ...parsed.data,
      authorWebsite: parsed.data.authorWebsite || null,
    });
  } catch (err) {
    console.error("submitTemplateAction failed:", err);
    return { success: false, error: "Something went wrong submitting your template. Please try again." };
  }

  return { success: true };
}
