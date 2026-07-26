import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugForApprovedSubmission } from "@/lib/community-theme";
import type {
  TemplateSubmissionCategory,
  TemplateSubmissionInput,
  TemplateSubmissionRecord,
  TemplateSubmissionStatus,
} from "@/types/template-submission";
import type { TemplateAnimationPersonality } from "@/lib/template-catalog";

interface TemplateSubmissionRow {
  id: string;
  name: string;
  description: string;
  category: string;
  author_name: string;
  author_website: string | null;
  author_email: string;
  base_dark_color: string;
  base_accent_color: string;
  base_light_color: string;
  font_display: string;
  animation: string;
  status: string;
  admin_note: string | null;
  slug: string | null;
  created_at: string;
  reviewed_at: string | null;
}

function mapSubmission(row: TemplateSubmissionRow): TemplateSubmissionRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as TemplateSubmissionCategory,
    authorName: row.author_name,
    authorWebsite: row.author_website,
    authorEmail: row.author_email,
    baseDarkColor: row.base_dark_color,
    baseAccentColor: row.base_accent_color,
    baseLightColor: row.base_light_color,
    fontDisplay: row.font_display,
    animation: row.animation as TemplateAnimationPersonality,
    status: row.status as TemplateSubmissionStatus,
    adminNote: row.admin_note,
    slug: row.slug,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export async function createTemplateSubmission(
  input: TemplateSubmissionInput,
): Promise<TemplateSubmissionRecord> {
  const { data, error } = await supabaseAdmin()
    .from("template_submissions")
    .insert({
      name: input.name,
      description: input.description,
      category: input.category,
      author_name: input.authorName,
      author_website: input.authorWebsite || null,
      author_email: input.authorEmail,
      base_dark_color: input.baseDarkColor,
      base_accent_color: input.baseAccentColor,
      base_light_color: input.baseLightColor,
      font_display: input.fontDisplay,
      animation: input.animation,
    })
    .select("*")
    .single<TemplateSubmissionRow>();

  if (error) throw new Error(`Failed to submit template: ${error.message}`);
  return mapSubmission(data);
}

export async function listTemplateSubmissions(
  status?: TemplateSubmissionStatus,
): Promise<TemplateSubmissionRecord[]> {
  let query = supabaseAdmin()
    .from("template_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query.returns<TemplateSubmissionRow[]>();
  if (error) throw new Error(`Failed to load template submissions: ${error.message}`);
  return (data ?? []).map(mapSubmission);
}

/** Approved submissions only, keyed for merging into the render-time template catalog (see lib/templates.ts resolveTemplate). */
export async function listApprovedTemplateSubmissions(): Promise<TemplateSubmissionRecord[]> {
  return listTemplateSubmissions("approved");
}

export async function getTemplateSubmissionBySlug(
  slug: string,
): Promise<TemplateSubmissionRecord | null> {
  const { data, error } = await supabaseAdmin()
    .from("template_submissions")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle<TemplateSubmissionRow>();

  if (error) throw new Error(`Failed to load template: ${error.message}`);
  return data ? mapSubmission(data) : null;
}

export async function approveTemplateSubmission(
  id: string,
): Promise<TemplateSubmissionRecord> {
  const existing = await supabaseAdmin()
    .from("template_submissions")
    .select("id, name")
    .eq("id", id)
    .single<{ id: string; name: string }>();

  if (existing.error) throw new Error(`Failed to load submission: ${existing.error.message}`);

  const slug = slugForApprovedSubmission(existing.data);

  const { data, error } = await supabaseAdmin()
    .from("template_submissions")
    .update({ status: "approved", slug, reviewed_at: new Date().toISOString(), admin_note: null })
    .eq("id", id)
    .select("*")
    .single<TemplateSubmissionRow>();

  if (error) throw new Error(`Failed to approve template: ${error.message}`);
  return mapSubmission(data);
}

export async function rejectTemplateSubmission(
  id: string,
  note?: string,
): Promise<TemplateSubmissionRecord> {
  const { data, error } = await supabaseAdmin()
    .from("template_submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), admin_note: note || null })
    .eq("id", id)
    .select("*")
    .single<TemplateSubmissionRow>();

  if (error) throw new Error(`Failed to reject template: ${error.message}`);
  return mapSubmission(data);
}
