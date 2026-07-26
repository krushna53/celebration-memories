"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/services/admin-auth";
import { approveTemplateSubmission, rejectTemplateSubmission } from "@/services/template-submissions";

export type TemplateSubmissionActionResult = { success: true } | { success: false; error: string };

// Reviewing community template submissions is owner-only — approving one
// makes it render live on any client's event page, so every action here
// re-checks role via requireOwner(), independent of the page-level guard
// (and this page isn't in CLIENT_ALLOWED_PATHS to begin with).

export async function approveTemplateSubmissionAction(
  id: string,
): Promise<TemplateSubmissionActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await approveTemplateSubmission(id);
    revalidatePath("/admin/template-submissions");
    revalidatePath("/admin/templates");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function rejectTemplateSubmissionAction(
  id: string,
  note: string,
): Promise<TemplateSubmissionActionResult> {
  try {
    await requireOwner();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Not authorized." };
  }

  try {
    await rejectTemplateSubmission(id, note);
    revalidatePath("/admin/template-submissions");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
