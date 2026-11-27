import "server-only";

import { BLOG_POSTS, type BlogPost } from "@/features/blog/posts";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ManagedBlogPost = BlogPost & {
  id: string;
  tags: string[];
  published: boolean;
  sortOrder: number;
};

type BlogRow = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date_label: string;
  read_time: string;
  image_url: string;
  image_alt: string;
  tags: string[];
  sections: { heading: string; body: string }[];
  quote: string | null;
  published: boolean;
  sort_order: number;
};

function fromRow(row: BlogRow): ManagedBlogPost {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    excerpt: row.excerpt,
    date: row.date_label,
    readTime: row.read_time,
    image: row.image_url,
    imageAlt: row.image_alt,
    tags: row.tags ?? [],
    sections: row.sections ?? [],
    quote: row.quote ?? undefined,
    published: row.published,
    sortOrder: row.sort_order,
  };
}

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("blog_posts")
      .select("id, slug, category, title, excerpt, date_label, read_time, image_url, image_alt, tags, sections, quote, published, sort_order")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .returns<BlogRow[]>();
    if (error) throw error;
    return (data ?? []).map(fromRow);
  } catch (error) {
    // Existing public stories stay available until the migration is applied.
    console.error("Could not load blog posts from Supabase:", error instanceof Error ? error.message : error);
    return BLOG_POSTS;
  }
}

export async function getAllManagedBlogPosts(): Promise<ManagedBlogPost[]> {
  const { data, error } = await supabaseAdmin()
    .from("blog_posts")
    .select("id, slug, category, title, excerpt, date_label, read_time, image_url, image_alt, tags, sections, quote, published, sort_order")
    .order("sort_order", { ascending: true })
    .returns<BlogRow[]>();
  if (error) throw new Error(`Could not load posts. Apply the blog migration first. (${error.message})`);
  return (data ?? []).map(fromRow);
}

