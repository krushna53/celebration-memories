"use server";

import { revalidatePath } from "next/cache";
import { requireBlogAdmin } from "@/services/blog-access";
import { createSignedBlogImageUpload } from "@/services/uploads";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type BlogSection = { heading: string; body: string };
export type BlogPostInput = {
  id?: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  date: string;
  readTime: string;
  image: string;
  imageAlt: string;
  tags: string[];
  sections: BlogSection[];
  quote?: string;
  published: boolean;
  sortOrder: number;
};
export type BlogActionResult = { success: true; id?: string } | { success: false; error: string };

export async function requestBlogImageUploadAction(fileName: string, contentType: string, fileSize: number) {
  try {
    await requireBlogAdmin();
    return { success: true as const, data: await createSignedBlogImageUpload({ fileName, contentType, fileSize }) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Image upload could not start." };
  }
}

function slugFromTitle(title: string) {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export async function saveBlogPostAction(input: BlogPostInput): Promise<BlogActionResult> {
  try {
    await requireBlogAdmin();
    const title = typeof input.title === "string" ? input.title.trim().slice(0, 180) : "";
    const excerpt = typeof input.excerpt === "string" ? input.excerpt.trim().slice(0, 500) : "";
    const image = typeof input.image === "string" ? input.image.trim().slice(0, 2048) : "";
    const category = typeof input.category === "string" ? input.category.trim().slice(0, 80) : "";
    const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map((tag) => String(tag).trim().slice(0, 40)).filter(Boolean))].slice(0, 12) : [];
    const sections = Array.isArray(input.sections) ? input.sections.slice(0, 12).map((section) => ({
      heading: String(section.heading ?? "").trim().slice(0, 160),
      body: String(section.body ?? "").trim().slice(0, 2500),
    })).filter((section) => section.heading || section.body) : [];
    const slug = slugFromTitle(input.slug?.trim() || title);
    if (!title || !slug || !category) return { success: false, error: "Add a title and category before saving." };
    if (image && !image.startsWith("/") && !/^https:\/\//i.test(image)) return { success: false, error: "Use a site image path or an HTTPS image URL." };
    if (input.published && (!excerpt || !image || sections.length === 0)) return { success: false, error: "Published posts need a description, a cover image, and at least one section." };

    const row = {
      slug,
      category,
      title,
      excerpt,
      date_label: String(input.date ?? "").trim().slice(0, 50),
      read_time: String(input.readTime ?? "").trim().slice(0, 40) || "5 min read",
      image_url: image,
      image_alt: String(input.imageAlt ?? "").trim().slice(0, 220),
      tags,
      sections,
      quote: String(input.quote ?? "").trim().slice(0, 500) || null,
      published: Boolean(input.published),
      sort_order: Number.isFinite(input.sortOrder) ? Math.max(0, Math.min(100000, Math.trunc(input.sortOrder))) : 0,
      updated_at: new Date().toISOString(),
    };
    const client = supabaseAdmin();
    let id = input.id;
    if (id) {
      const { error } = await client.from("blog_posts").update(row).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await client.from("blog_posts").insert(row).select("id").single<{ id: string }>();
      if (error || !data) throw error ?? new Error("The blog post could not be saved.");
      id = data.id;
    }
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    revalidatePath("/admin/blog");
    return { success: true, id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save the blog post." };
  }
}

export async function deleteBlogPostAction(id: string): Promise<BlogActionResult> {
  try {
    await requireBlogAdmin();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, error: "Invalid post." };
    const { error } = await supabaseAdmin().from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/blog");
    revalidatePath("/admin/blog");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not delete the post." };
  }
}

