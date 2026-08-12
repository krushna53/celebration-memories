import "server-only";
import { randomBytes } from "node:crypto";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateDraftToken } from "@/lib/tokens";
import { publicMediaUrl } from "@/services/uploads";

/**
 * Backing service for the standalone Custom Form Builder (#95-101) —
 * platform-wide, independent of the per-event RSVP system (see
 * supabase/migrations/0046_custom_form_builder.sql). Two trust models
 * coexist here, same split as the event wizard:
 *
 * - Building a form needs no account: whoever holds a form's
 *   `draft_token` (a long random URL token, /forms/build/[token]) can
 *   edit it — same "possession of the token is the credential" pattern
 *   as services/event-drafts.ts. This never expires, even after
 *   publish, so an owner who skipped account creation can always get
 *   back in with the same link.
 * - Viewing/managing responses needs a real account — a lightweight,
 *   separate allowlist (`form_owners`, mirrors services/business-auth.ts's
 *   `business_accounts`) rather than the event-scoped `admins` table,
 *   since one person can own many forms with no event relationship at
 *   all. See getCurrentFormOwner/requireFormOwner below.
 */

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export type CustomFormStatus = "draft" | "published" | "closed";
export type CustomFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox";

export interface CustomForm {
  id: string;
  ownerId: string | null;
  draftToken: string;
  slug: string;
  title: string;
  description: string | null;
  coverImagePath: string | null;
  coverImageUrl: string | null;
  notifyEmail: string | null;
  notifyOnSubmit: boolean;
  status: CustomFormStatus;
  createdAt: string;
  updatedAt: string;
}

interface CustomFormRow {
  id: string;
  owner_id: string | null;
  draft_token: string;
  slug: string;
  title: string;
  description: string | null;
  cover_image_path: string | null;
  notify_email: string | null;
  notify_on_submit: boolean;
  status: CustomFormStatus;
  created_at: string;
  updated_at: string;
}

function mapForm(row: CustomFormRow): CustomForm {
  return {
    id: row.id,
    ownerId: row.owner_id,
    draftToken: row.draft_token,
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverImagePath: row.cover_image_path,
    coverImageUrl: row.cover_image_path ? publicMediaUrl("gallery", row.cover_image_path) : null,
    notifyEmail: row.notify_email,
    notifyOnSubmit: row.notify_on_submit,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function randomSlugSuffix(): string {
  return randomBytes(4).toString("hex");
}

/** Creates a brand-new draft form with no fields yet — the builder page fills in title/fields/cover after. */
export async function createDraftForm(): Promise<{ id: string; token: string }> {
  const token = generateDraftToken();
  const slug = `form-${randomSlugSuffix()}`;

  const { data, error } = await supabaseAdmin()
    .from("custom_forms")
    .insert({ draft_token: token, slug, title: "Untitled Form" })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new Error(`Failed to create form: ${error?.message}`);
  return { id: data.id, token };
}

/** Resolves a form by its builder URL token — the credential for editing (see this file's header comment). Works regardless of status, so a published form's builder link keeps working. */
export async function getFormByDraftToken(token: string): Promise<CustomForm | null> {
  const { data, error } = await supabaseAdmin()
    .from("custom_forms")
    .select("*")
    .eq("draft_token", token)
    .maybeSingle<CustomFormRow>();

  if (error) {
    console.error("getFormByDraftToken failed:", error.message);
    return null;
  }
  return data ? mapForm(data) : null;
}

/** Resolves a form by its public fill-page slug — callers decide how to render based on `status` (draft = not found, published = the form, closed = "no longer accepting responses"). */
export async function getFormBySlug(slug: string): Promise<CustomForm | null> {
  const { data, error } = await supabaseAdmin()
    .from("custom_forms")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<CustomFormRow>();

  if (error) {
    console.error("getFormBySlug failed:", error.message);
    return null;
  }
  return data ? mapForm(data) : null;
}

export async function getFormById(id: string): Promise<CustomForm | null> {
  const { data, error } = await supabaseAdmin()
    .from("custom_forms")
    .select("*")
    .eq("id", id)
    .maybeSingle<CustomFormRow>();

  if (error) {
    console.error("getFormById failed:", error.message);
    return null;
  }
  return data ? mapForm(data) : null;
}

export interface UpdateFormInput {
  title?: string;
  description?: string | null;
  coverImagePath?: string | null;
  notifyEmail?: string | null;
  notifyOnSubmit?: boolean;
}

export async function updateForm(formId: string, input: UpdateFormInput): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.coverImagePath !== undefined) patch.cover_image_path = input.coverImagePath;
  if (input.notifyEmail !== undefined) patch.notify_email = input.notifyEmail;
  if (input.notifyOnSubmit !== undefined) patch.notify_on_submit = input.notifyOnSubmit;

  const { error } = await supabaseAdmin().from("custom_forms").update(patch).eq("id", formId);
  if (error) throw new Error(`Failed to update form: ${error.message}`);
}

export async function publishForm(formId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("custom_forms")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", formId);
  if (error) throw new Error(`Failed to publish form: ${error.message}`);
}

export async function setFormStatus(formId: string, status: CustomFormStatus): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("custom_forms")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", formId);
  if (error) throw new Error(`Failed to update form status: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export interface CustomFormField {
  id: string;
  formId: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[] | null;
  required: boolean;
  sortOrder: number;
}

interface CustomFormFieldRow {
  id: string;
  form_id: string;
  label: string;
  field_type: CustomFieldType;
  options: string[] | null;
  required: boolean;
  sort_order: number;
}

function mapField(row: CustomFormFieldRow): CustomFormField {
  return {
    id: row.id,
    formId: row.form_id,
    label: row.label,
    fieldType: row.field_type,
    options: row.options,
    required: row.required,
    sortOrder: row.sort_order,
  };
}

export async function listFields(formId: string): Promise<CustomFormField[]> {
  const { data, error } = await supabaseAdmin()
    .from("custom_form_fields")
    .select("*")
    .eq("form_id", formId)
    .order("sort_order", { ascending: true })
    .returns<CustomFormFieldRow[]>();

  if (error) throw new Error(`Failed to load fields: ${error.message}`);
  return (data ?? []).map(mapField);
}

export interface CreateFieldInput {
  formId: string;
  label: string;
  fieldType: CustomFieldType;
  options?: string[] | null;
  required: boolean;
}

export async function createField(input: CreateFieldInput): Promise<CustomFormField> {
  if (!input.label.trim()) throw new Error("Please enter a field label.");

  const { count } = await supabaseAdmin()
    .from("custom_form_fields")
    .select("id", { count: "exact", head: true })
    .eq("form_id", input.formId);

  const { data, error } = await supabaseAdmin()
    .from("custom_form_fields")
    .insert({
      form_id: input.formId,
      label: input.label.trim(),
      field_type: input.fieldType,
      options: input.options ?? null,
      required: input.required,
      sort_order: count ?? 0,
    })
    .select("*")
    .single<CustomFormFieldRow>();

  if (error || !data) throw new Error(`Failed to add field: ${error?.message}`);
  return mapField(data);
}

/**
 * Wholesale replaces every field on a form — used by AI generation
 * (features/forms/builder-actions.ts), where the whole point is to
 * hand back a complete, freshly-designed field set rather than append
 * to whatever was already there. Deletes then bulk-inserts rather than
 * looping createField() calls, so sort order comes out correct in one
 * pass instead of N round trips.
 */
export async function replaceFormFields(formId: string, fields: Omit<CreateFieldInput, "formId">[]): Promise<CustomFormField[]> {
  const client = supabaseAdmin();

  const { error: deleteError } = await client.from("custom_form_fields").delete().eq("form_id", formId);
  if (deleteError) throw new Error(`Failed to clear existing fields: ${deleteError.message}`);

  if (fields.length === 0) return [];

  const { data, error: insertError } = await client
    .from("custom_form_fields")
    .insert(
      fields.map((field, index) => ({
        form_id: formId,
        label: field.label.trim(),
        field_type: field.fieldType,
        options: field.options ?? null,
        required: field.required,
        sort_order: index,
      })),
    )
    .select("*")
    .returns<CustomFormFieldRow[]>();

  if (insertError || !data) throw new Error(`Failed to save generated fields: ${insertError?.message}`);
  return data.map(mapField).sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface UpdateFieldInput {
  label?: string;
  fieldType?: CustomFieldType;
  options?: string[] | null;
  required?: boolean;
  sortOrder?: number;
}

export async function updateField(fieldId: string, input: UpdateFieldInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.fieldType !== undefined) patch.field_type = input.fieldType;
  if (input.options !== undefined) patch.options = input.options;
  if (input.required !== undefined) patch.required = input.required;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { error } = await supabaseAdmin().from("custom_form_fields").update(patch).eq("id", fieldId);
  if (error) throw new Error(`Failed to update field: ${error.message}`);
}

export async function deleteField(fieldId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("custom_form_fields").delete().eq("id", fieldId);
  if (error) throw new Error(`Failed to delete field: ${error.message}`);
}

/** Looks up which form a field belongs to — used to confirm a builder-token session is allowed to touch it, closing the gap where any draft_token could edit another form's field by id alone. */
export async function getFieldFormId(fieldId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("custom_form_fields")
    .select("form_id")
    .eq("id", fieldId)
    .maybeSingle<{ form_id: string }>();
  if (error) throw new Error(`Failed to look up field: ${error.message}`);
  return data?.form_id ?? null;
}

/** Bulk-persists a new field order after a drag/reorder in the builder. */
export async function reorderFields(formId: string, orderedFieldIds: string[]): Promise<void> {
  const client = supabaseAdmin();
  await Promise.all(
    orderedFieldIds.map((fieldId, index) =>
      client.from("custom_form_fields").update({ sort_order: index }).eq("id", fieldId).eq("form_id", formId),
    ),
  );
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface CustomFormResponse {
  id: string;
  formId: string;
  data: Record<string, string | string[]>;
  submittedAt: string;
}

interface CustomFormResponseRow {
  id: string;
  form_id: string;
  data: Record<string, string | string[]>;
  submitted_at: string;
}

function mapResponse(row: CustomFormResponseRow): CustomFormResponse {
  return { id: row.id, formId: row.form_id, data: row.data ?? {}, submittedAt: row.submitted_at };
}

/** Public submission — only accepted while the form is published. Validates required fields server-side (never trust client-side validation alone). */
export async function submitFormResponse(
  formId: string,
  data: Record<string, string | string[]>,
): Promise<{ id: string }> {
  const form = await getFormById(formId);
  if (!form || form.status !== "published") {
    throw new Error("This form isn't currently accepting responses.");
  }

  const fields = await listFields(formId);
  for (const field of fields) {
    if (!field.required) continue;
    const value = data[field.id];
    const isEmpty = value === undefined || value === null || (Array.isArray(value) ? value.length === 0 : value.trim() === "");
    if (isEmpty) throw new Error(`"${field.label}" is required.`);
  }

  const { data: inserted, error } = await supabaseAdmin()
    .from("custom_form_responses")
    .insert({ form_id: formId, data })
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) throw new Error(`Failed to submit: ${error?.message}`);
  return { id: inserted.id };
}

export async function listResponses(formId: string): Promise<CustomFormResponse[]> {
  const { data, error } = await supabaseAdmin()
    .from("custom_form_responses")
    .select("*")
    .eq("form_id", formId)
    .order("submitted_at", { ascending: false })
    .returns<CustomFormResponseRow[]>();

  if (error) throw new Error(`Failed to load responses: ${error.message}`);
  return (data ?? []).map(mapResponse);
}

/** Looks up which form a response belongs to — same ownership-check pattern as getFieldFormId. */
export async function getResponseFormId(responseId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from("custom_form_responses")
    .select("form_id")
    .eq("id", responseId)
    .maybeSingle<{ form_id: string }>();
  if (error) throw new Error(`Failed to look up response: ${error.message}`);
  return data?.form_id ?? null;
}

export async function updateResponse(responseId: string, data: Record<string, string | string[]>): Promise<void> {
  const { error } = await supabaseAdmin().from("custom_form_responses").update({ data }).eq("id", responseId);
  if (error) throw new Error(`Failed to update response: ${error.message}`);
}

export async function deleteResponse(responseId: string): Promise<void> {
  const { error } = await supabaseAdmin().from("custom_form_responses").delete().eq("id", responseId);
  if (error) throw new Error(`Failed to delete response: ${error.message}`);
}

/** Bulk-inserts responses from a CSV import, matching columns to fields by (case-insensitive) label. Unmatched columns are ignored; missing columns are left blank. Mirrors bulkImportInvitees' "best effort, skip bad rows" shape. */
export async function bulkImportResponses(
  formId: string,
  rows: Record<string, string>[],
): Promise<{ created: number; skipped: number }> {
  const fields = await listFields(formId);
  const byLowerLabel = new Map(fields.map((f) => [f.label.trim().toLowerCase(), f]));

  let created = 0;
  let skipped = 0;
  const toInsert: { form_id: string; data: Record<string, string> }[] = [];

  for (const row of rows) {
    const data: Record<string, string> = {};
    let matchedAny = false;
    for (const [column, value] of Object.entries(row)) {
      const field = byLowerLabel.get(column.trim().toLowerCase());
      if (!field) continue;
      data[field.id] = value ?? "";
      matchedAny = true;
    }
    if (!matchedAny) {
      skipped++;
      continue;
    }
    toInsert.push({ form_id: formId, data });
  }

  if (toInsert.length > 0) {
    const { error } = await supabaseAdmin().from("custom_form_responses").insert(toInsert);
    if (error) throw new Error(`Failed to import responses: ${error.message}`);
    created = toInsert.length;
  }

  return { created, skipped };
}

/** Response rows shaped for lib/csv.ts's toCsv — one column per field (by label, in sort order) plus a fixed "Submitted At" column, since a custom form's column set is only known at runtime. */
export async function getResponseExportRows(
  formId: string,
): Promise<{ columns: { key: string; label: string }[]; rows: Record<string, string>[] }> {
  const [fields, responses] = await Promise.all([listFields(formId), listResponses(formId)]);

  const columns = [...fields.map((f) => ({ key: f.id, label: f.label })), { key: "__submittedAt", label: "Submitted At" }];

  const rows = responses.map((response) => {
    const row: Record<string, string> = {};
    for (const field of fields) {
      const value = response.data[field.id];
      row[field.id] = Array.isArray(value) ? value.join(", ") : (value ?? "");
    }
    row.__submittedAt = response.submittedAt;
    return row;
  });

  return { columns, rows };
}

// ---------------------------------------------------------------------------
// Form owner accounts (auth) — separate allowlist from services/admin-auth.ts
// ---------------------------------------------------------------------------

export interface CurrentFormOwner {
  id: string;
  email: string;
  name: string | null;
}

/** Mirrors services/business-auth.ts's getCurrentBusinessAccount exactly, just a different backing table — same Supabase Auth session, a different allowlist. */
export async function getCurrentFormOwner(): Promise<CurrentFormOwner | null> {
  const session = await supabaseServer();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseAdmin()
    .from("form_owners")
    .select("id, email, name")
    .eq("id", user.id)
    .maybeSingle<CurrentFormOwner>();

  if (error) {
    console.error("Failed to check form_owners:", error.message);
    return null;
  }
  return data;
}

export async function requireFormOwner(): Promise<CurrentFormOwner> {
  const owner = await getCurrentFormOwner();
  if (!owner) throw new Error("Please sign in to your account.");
  return owner;
}

/**
 * Creates the form_owners row right after a successful
 * supabaseBrowser().auth.signUp() call, then claims the one form they
 * just built (sets custom_forms.owner_id) — not gated on email
 * confirmation, same reasoning as createBusinessAccount. The claim only
 * applies `owner_id is null`, so this can never be used to steal an
 * already-claimed form even if a formId were guessed or reused.
 */
export async function createFormOwnerAccount(
  userId: string,
  email: string,
  name: string,
  claimFormId?: string,
): Promise<void> {
  const { data: userData, error: userError } = await supabaseAdmin().auth.admin.getUserById(userId);
  if (userError || !userData?.user || userData.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Could not verify your account. Please try signing up again.");
  }

  const { error } = await supabaseAdmin()
    .from("form_owners")
    .upsert({ id: userId, email, name }, { onConflict: "id" });
  if (error) throw new Error(`Failed to create your account: ${error.message}`);

  if (claimFormId) {
    await supabaseAdmin()
      .from("custom_forms")
      .update({ owner_id: userId })
      .eq("id", claimFormId)
      .is("owner_id", null);
  }
}

/** Every form owned by this account, most recently updated first — for /forms/dashboard's form-picker. */
export async function listFormsForOwner(ownerId: string): Promise<CustomForm[]> {
  const { data, error } = await supabaseAdmin()
    .from("custom_forms")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .returns<CustomFormRow[]>();

  if (error) throw new Error(`Failed to load your forms: ${error.message}`);
  return (data ?? []).map(mapForm);
}
