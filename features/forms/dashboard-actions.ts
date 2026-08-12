"use server";

import { revalidatePath } from "next/cache";

import {
  bulkImportResponses,
  deleteResponse,
  getFormById,
  getResponseExportRows,
  getResponseFormId,
  requireFormOwner,
  setFormStatus,
  updateResponse,
  type CustomFormStatus,
} from "@/services/custom-forms";
import { toCsv } from "@/lib/csv";

export type DashboardActionResult = { success: true } | { success: false; error: string };

/** Confirms the signed-in form owner actually owns this form before any mutation below — re-checked per action, same pattern as every other admin-style Server Action in this app. */
async function requireOwnedForm(formId: string) {
  const owner = await requireFormOwner();
  const form = await getFormById(formId);
  if (!form || form.ownerId !== owner.id) {
    throw new Error("You don't have access to this form.");
  }
  return { owner, form };
}

export type ExportResponsesCsvResult =
  | { success: true; csv: string; filename: string }
  | { success: false; error: string };

export async function exportResponsesCsvAction(formId: string): Promise<ExportResponsesCsvResult> {
  try {
    const { form } = await requireOwnedForm(formId);
    const { columns, rows } = await getResponseExportRows(formId);
    const csv = toCsv(rows, columns);
    const safeTitle = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "form";
    return { success: true, csv, filename: `${safeTitle}-responses-${new Date().toISOString().slice(0, 10)}.csv` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Export failed." };
  }
}

export async function bulkImportResponsesAction(
  formId: string,
  rows: Record<string, string>[],
): Promise<{ success: true; created: number; skipped: number } | { success: false; error: string }> {
  try {
    await requireOwnedForm(formId);
    const result = await bulkImportResponses(formId, rows);
    revalidatePath(`/forms/dashboard/${formId}`);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Import failed." };
  }
}

/** Looks up which form a response belongs to, then confirms ownership — closes the gap where any signed-in form owner could edit another owner's response by id alone. */
export async function updateResponseAction(
  responseId: string,
  data: Record<string, string | string[]>,
): Promise<DashboardActionResult> {
  try {
    const formId = await getResponseFormId(responseId);
    if (!formId) return { success: false, error: "Response not found." };
    await requireOwnedForm(formId);
    await updateResponse(responseId, data);
    revalidatePath(`/forms/dashboard/${formId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteResponseAction(responseId: string): Promise<DashboardActionResult> {
  try {
    const formId = await getResponseFormId(responseId);
    if (!formId) return { success: false, error: "Response not found." };
    await requireOwnedForm(formId);
    await deleteResponse(responseId);
    revalidatePath(`/forms/dashboard/${formId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function setFormStatusAction(formId: string, status: CustomFormStatus): Promise<DashboardActionResult> {
  try {
    await requireOwnedForm(formId);
    await setFormStatus(formId, status);
    revalidatePath(`/forms/dashboard/${formId}`);
    revalidatePath("/forms/dashboard");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
