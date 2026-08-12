"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  createDraftForm,
  createField,
  createFormOwnerAccount,
  deleteField,
  getFieldFormId,
  getFormByDraftToken,
  publishForm,
  reorderFields,
  replaceFormFields,
  updateField,
  updateForm,
  type CreateFieldInput,
  type CustomFormField,
  type UpdateFieldInput,
  type UpdateFormInput,
} from "@/services/custom-forms";
import { createSignedCustomFormCoverUpload } from "@/services/uploads";
import { generateFormFromImage, generateFormFromPrompt } from "@/lib/ai-form-generator";
import {
  checkCustomFormAiGenerationRateLimit,
  recordCustomFormAiGenerationRequest,
} from "@/services/custom-form-ai-rate-limit";
import { getClientIp, hashIp } from "@/lib/ip-hash";
import { FORM_CATEGORY_STARTER_FIELDS, type FormCategory } from "@/lib/form-category";

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

/**
 * Entry point for the /forms/new wizard (features/forms/new-form-wizard.tsx)
 * — step 1 picks the "RSVP instance" (category), step 2 picks how to
 * build it. `includeStarterFields` is true for the "build it myself"
 * path (drops in that category's FORM_CATEGORY_STARTER_FIELDS, fully
 * editable after) and false for the "generate with AI" path (nothing
 * to pre-fill — the very next call replaces the field set anyway).
 */
export async function createDraftFormAction(
  category: FormCategory,
  includeStarterFields: boolean,
): Promise<{ success: true; id: string; token: string } | { success: false; error: string }> {
  try {
    const starterFields = includeStarterFields ? FORM_CATEGORY_STARTER_FIELDS[category] : undefined;
    const { id, token } = await createDraftForm(category, starterFields);
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

export type GenerateFormActionResult =
  | { success: true; title: string; description: string | null; fields: CustomFormField[] }
  | { success: false; error: string };

/**
 * Shared by both AI generation entry points below — persists the
 * model's output as this form's new title/description/fields
 * (wholesale replacing any existing fields, see
 * services/custom-forms.ts's replaceFormFields doc comment) and
 * returns the persisted rows so the builder UI can update its state
 * from a single source of truth rather than trusting the client's copy
 * of what it sent.
 */
async function applyGeneratedForm(
  token: string,
  generated: { title: string; description: string | null; fields: { label: string; fieldType: CreateFieldInput["fieldType"]; required: boolean; options: string[] | null }[] },
): Promise<GenerateFormActionResult> {
  const form = await requireFormByToken(token);
  await updateForm(form.id, { title: generated.title, description: generated.description });
  const fields = await replaceFormFields(form.id, generated.fields);
  revalidatePath(`/forms/build/${token}`);
  return { success: true, title: generated.title, description: generated.description, fields };
}

/** Checks the shared per-IP/global AI-generation rate limit (services/custom-form-ai-rate-limit.ts) — reachable by anyone holding a form's draft_token, so this is the real cost guard, not the token itself. Records the attempt only after a successful OpenAI call, so a request that fails validation doesn't unfairly count against the caller's quota. */
async function checkAiGenerationRateLimit(): Promise<{ ok: true; ipHash: string } | { ok: false; error: string }> {
  const ipHash = hashIp(getClientIp(await headers()));
  const rateLimit = await checkCustomFormAiGenerationRateLimit(ipHash);
  if (!rateLimit.allowed) {
    return { ok: false, error: rateLimit.reason ?? "Please try again later." };
  }
  return { ok: true, ipHash };
}

export async function generateFormFromPromptAction(token: string, prompt: string): Promise<GenerateFormActionResult> {
  try {
    const form = await requireFormByToken(token);
    const rateLimit = await checkAiGenerationRateLimit();
    if (!rateLimit.ok) return { success: false, error: rateLimit.error };

    const { form: generated, usage } = await generateFormFromPrompt(prompt, form.category);
    await recordCustomFormAiGenerationRequest(rateLimit.ipHash, {
      mode: "prompt",
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      formId: form.id,
      category: form.category,
    });
    return await applyGeneratedForm(token, generated);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to generate the form." };
  }
}

/** `imageDataUrl` is a full data URL built client-side from the picked file — never written to Storage, since it's only needed for this one-off analysis. */
export async function generateFormFromImageAction(token: string, imageDataUrl: string): Promise<GenerateFormActionResult> {
  try {
    const form = await requireFormByToken(token);
    const rateLimit = await checkAiGenerationRateLimit();
    if (!rateLimit.ok) return { success: false, error: rateLimit.error };

    const { form: generated, usage } = await generateFormFromImage(imageDataUrl, form.category);
    await recordCustomFormAiGenerationRequest(rateLimit.ipHash, {
      mode: "image",
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      formId: form.id,
      category: form.category,
    });
    return await applyGeneratedForm(token, generated);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to read that image." };
  }
}
