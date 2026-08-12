"use server";

import { revalidatePath } from "next/cache";

import {
  createDraftForm,
  createField,
  createFormOwnerAccount,
  deleteField,
  getFieldFormId,
  getFormByDraftToken,
  publishForm,
  reorderFields,
  updateField,
  updateForm,
  type CreateFieldInput,
  type UpdateFieldInput,
  type UpdateFormInput,
} from "@/services/custom-forms";
import { createSignedCustomFormCoverUpload } from "@/services/uploads";

export type FormActionResult = { success: true } | { success: false; error: string };

/**
 * Every action here takes the builder's draft_token and re-resolves the
 * form from it server-side, never trusting a client-supplied formId
 * alone — same "possession of the token is the credential" pattern as
 * features/start/actions.ts's draft-token-gated wrappers. This is what
 * lets someone build a form with no login at all.
 */
async function requireFormByToken(token: string) {
  const form = await getFormByDraftToken(token);
  if (!form) throw new Error("This form link isn't valid — it may have been deleted.");
  return form;
}

export async function createDraftFormAction(): Promise<
  { success: true; id: string; token: string } | { success: false; error: string }
> {
  try {
    const { id, token } = await createDraftForm();
    return { success: true, id, token };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start a new form." };
  }
}

export async function updateFormMetaAction(token: string, input: UpdateFormInput): Promise<FormActionResult> {
  try {
    const form = await requireFormByToken(token);
    if (input.title !== undefined && !input.title.trim()) {
      return { success: false, error: "Please give your form a title." };
    }
    await updateForm(form.id, input);
    revalidatePath(`/forms/build/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function publishFormAction(token: string): Promise<FormActionResult> {
  try {
    const form = await requireFormByToken(token);
    await publishForm(form.id);
    revalidatePath(`/forms/build/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to publish." };
  }
}

export async function requestFormCoverUploadUrlAction(
  token: string,
  fileName: string,
  contentType: string,
  fileSize: number,
) {
  try {
    const form = await requireFormByToken(token);
    const upload = await createSignedCustomFormCoverUpload({ formId: form.id, fileName, contentType, fileSize });
    return { success: true as const, data: upload };
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function confirmFormCoverUploadAction(token: string, path: string): Promise<FormActionResult> {
  try {
    const form = await requireFormByToken(token);
    await updateForm(form.id, { coverImagePath: path });
    revalidatePath(`/forms/build/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export type CreateFieldActionInput = Omit<CreateFieldInput, "formId">;

export async function createFieldAction(
  token: string,
  input: CreateFieldActionInput,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const form = await requireFormByToken(token);
    const field = await createField({ ...input, formId: form.id });
    revalidatePath(`/forms/build/${token}`);
    return { success: true, id: field.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add field." };
  }
}

/** Resolves and confirms the field belongs to this token's form before any mutation — closes the gap where a valid token for form A could edit form B's field by id alone. */
async function requireFieldForToken(token: string, fieldId: string) {
  const form = await requireFormByToken(token);
  const fieldFormId = await getFieldFormId(fieldId);
  if (fieldFormId !== form.id) throw new Error("That field doesn't belong to this form.");
  return form;
}

export async function updateFieldAction(token: string, fieldId: string, input: UpdateFieldInput): Promise<FormActionResult> {
  try {
    await requireFieldForToken(token, fieldId);
    await updateField(fieldId, input);
    revalidatePath(`/forms/build/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function deleteFieldAction(token: string, fieldId: string): Promise<FormActionResult> {
  try {
    await requireFieldForToken(token, fieldId);
    await deleteField(fieldId);
    revalidatePath(`/forms/build/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

export async function reorderFieldsAction(token: string, orderedFieldIds: string[]): Promise<FormActionResult> {
  try {
    const form = await requireFormByToken(token);
    await reorderFields(form.id, orderedFieldIds);
    revalidatePath(`/forms/build/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/**
 * Creates the form owner's account right after the browser's
 * supabaseBrowser().auth.signUp() call succeeds, and claims this one
 * form for them in the same step — see
 * services/custom-forms.ts's createFormOwnerAccount doc comment for why
 * the claim is safe even though it isn't wrapped in a DB transaction
 * (owner_id is only ever set from null, never overwritten).
 */
export async function createFormOwnerAccountAction(
  token: string,
  userId: string,
  email: string,
  name: string,
): Promise<FormActionResult> {
  try {
    const form = await requireFormByToken(token);
    await createFormOwnerAccount(userId, email, name, form.id);
    revalidatePath(`/forms/build/${token}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create your account." };
  }
}
