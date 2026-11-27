import { notFound } from "next/navigation";
import Link from "next/link";
import { canManageBlog } from "@/services/blog-access";
import { getCurrentAdmin } from "@/services/admin-auth";
import { getAllManagedBlogPosts } from "@/services/blog";
import type { ManagedBlogPost } from "@/services/blog";
import { BlogManager } from "@/features/admin/blog/blog-manager";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  if (!canManageBlog(admin)) return <section className="mx-auto max-w-2xl rounded-2xl border border-navy-950/10 bg-white p-6 shadow-sm sm:p-8" role="status">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold-700">Wedding Blog</p>
    <h1 className="mt-2 font-display text-2xl text-navy-950">You’re not authorized to manage the blog</h1>
    <p className="mt-2 text-sm leading-6 text-navy-700/70">This account doesn’t have blog editor access. Sign in with an authorized editor account or return to your dashboard.</p>
    <Link href="/admin" className="mt-5 inline-flex rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-white">Back to dashboard</Link>
  </section>;
  let posts: ManagedBlogPost[] = [];
  let loadError = "";
  try { posts = await getAllManagedBlogPosts(); }
  catch (error) { loadError = error instanceof Error ? error.message : "Could not load posts."; }

  return <div className="space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-gold-700">Platform</p><h1 className="mt-1 font-display text-2xl text-navy-950">Wedding Blog</h1><p className="mt-1 text-sm text-navy-700/65">Create, edit, and publish stories shown on the public blog.</p></div>
    {loadError ? <div role="alert" className="rounded-xl border border-gold-500/30 bg-white p-4 text-sm text-navy-800">{loadError}<p className="mt-2 text-xs text-navy-700/65">Apply the new Supabase migration <code>20261127120000_blog_cms.sql</code>, then refresh this page.</p></div> : <BlogManager initialPosts={posts} />}
  </div>;
}

