"use client";

import { useState } from "react";
import { Check, FilePlus2, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ManagedBlogPost } from "@/services/blog";
import {
  deleteBlogPostAction,
  requestBlogImageUploadAction,
  saveBlogPostAction,
  type BlogPostInput,
} from "@/features/admin/blog/actions";

/* eslint-disable @next/next/no-img-element -- Owner-managed image URLs may use arbitrary HTTPS hosts. */

type FormPost = BlogPostInput;
const toFormPost = (post: ManagedBlogPost): FormPost => ({ id: post.id, title: post.title, slug: post.slug, category: post.category, excerpt: post.excerpt, date: post.date, readTime: post.readTime, image: post.image, imageAlt: post.imageAlt, tags: post.tags, sections: post.sections, quote: post.quote ?? "", published: post.published, sortOrder: post.sortOrder });
const blankPost = (): FormPost => ({
  title: "", slug: "", category: "Wedding Ideas", excerpt: "", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  readTime: "5 min read", image: "", imageAlt: "", tags: [], sections: [{ heading: "", body: "" }], quote: "", published: false, sortOrder: 0,
});
const inputClass = "mt-1 w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-navy-700/65";

export function BlogManager({ initialPosts }: { initialPosts: ManagedBlogPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [form, setForm] = useState<FormPost | null>(() => initialPosts[0] ? toFormPost(initialPosts[0]) : null);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState<"save" | "draft" | "upload" | "delete" | null>(null);
  const [message, setMessage] = useState("");

  function edit(post: ManagedBlogPost) {
    setForm(toFormPost(post));
    setMessage("");
  }

  async function generateDraft() {
    if (!topic.trim() || busy) return;
    setBusy("draft"); setMessage("");
    try {
      const response = await fetch("/api/admin/blog/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Draft generation failed.");
      const d = result.draft;
      setForm({ ...(form ?? blankPost()), title: d.title, slug: (form?.slug || d.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), category: d.category || "Wedding Ideas", excerpt: d.excerpt || "", tags: Array.isArray(d.tags) ? d.tags : [], imageAlt: d.imageAlt || "", sections: Array.isArray(d.sections) ? d.sections : [], quote: d.quote || "", published: false });
      setMessage("AI draft added to the editor. Review it and choose Save draft or Publish.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Draft generation failed."); }
    finally { setBusy(null); }
  }

  async function uploadImage(file: File | undefined) {
    if (!file || !form || busy) return;
    setBusy("upload"); setMessage("");
    try {
      const signed = await requestBlogImageUploadAction(file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);
      const { bucket, path, token, viewUrl } = signed.data;
      const { error } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      setForm((current) => current ? { ...current, image: viewUrl } : current);
      setMessage("Cover image uploaded. Save the post to apply it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image upload failed."); }
    finally { setBusy(null); }
  }

  async function save(published: boolean) {
    if (!form || busy) return;
    setBusy("save"); setMessage("");
    const result = await saveBlogPostAction({ ...form, published });
    if (result.success) {
      setMessage(published ? "Post published." : "Draft saved.");
      window.location.reload();
    } else setMessage(result.error);
    setBusy(null);
  }

  async function remove(post: ManagedBlogPost) {
    if (!window.confirm(`Permanently delete “${post.title}”?`)) return;
    setBusy("delete"); setMessage("");
    const result = await deleteBlogPostAction(post.id);
    if (result.success) { setPosts((current) => current.filter((item) => item.id !== post.id)); if (form?.id === post.id) setForm(null); setMessage("Post deleted."); }
    else setMessage(result.error);
    setBusy(null);
  }

  const set = <K extends keyof FormPost>(key: K, value: FormPost[K]) => setForm((current) => current ? { ...current, [key]: value } : current);

  return <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(260px,350px)_minmax(0,1fr)]">
    <aside className="min-w-0 h-fit rounded-2xl border border-navy-950/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg">All posts</h2><p className="mt-1 text-xs text-navy-700/60">{posts.length} stories</p></div><button className="inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-3 py-2 text-xs font-semibold text-white" onClick={() => { setForm(blankPost()); setMessage(""); }}><FilePlus2 size={14} /> New post</button></div>
      <div className="mt-4 grid min-w-0 gap-2">{posts.map((post) => <div key={post.id} className={`flex min-w-0 items-center gap-2 rounded-xl border p-2.5 ${form?.id === post.id ? "border-gold-500 bg-gold-500/5" : "border-navy-950/10"}`}><button className="min-w-0 flex-1 overflow-hidden text-left" onClick={() => edit(post)}><span className="block line-clamp-2 break-words text-sm font-semibold">{post.title}</span><span className="mt-1 block truncate text-[11px] text-navy-700/55">{post.published ? "Published" : "Draft"} · {post.category}</span></button><button aria-label={`Delete ${post.title}`} onClick={() => void remove(post)} className="shrink-0 rounded-md p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button></div>)}</div>
    </aside>

    <section className="min-w-0 rounded-2xl border border-navy-950/10 bg-white p-4 sm:p-6">
      {!form ? <div className="py-14 text-center"><h2 className="font-display text-xl">Manage your wedding blog</h2><p className="mt-2 text-sm text-navy-700/60">Choose a post to edit or create one. AI drafts are optional.</p></div> : <>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-xl">{form.id ? "Edit post" : "New post"}</h2><p className="mt-1 text-xs text-navy-700/60">AI suggestions are drafts; nothing publishes until you choose Publish.</p></div><div className="flex gap-2"><button type="button" onClick={() => void save(false)} disabled={busy !== null} className="rounded-full border border-navy-950/20 px-4 py-2 text-sm">{busy === "save" ? "Saving…" : "Save draft"}</button><button type="button" onClick={() => void save(true)} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-4 py-2 text-sm font-semibold text-white"><Check size={15} />Publish</button></div></div>
        <div className="mt-5 rounded-xl border border-gold-500/20 bg-ivory-50 p-4"><label className={labelClass}>Write a topic for OpenAI</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} placeholder="e.g. Meaningful ideas for a small destination wedding" className="min-w-0 flex-1 rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm"/><button type="button" onClick={() => void generateDraft()} disabled={busy !== null || !topic.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-950 disabled:opacity-50">{busy === "draft" ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}Generate draft</button></div></div>

        {message && <p role="status" className="mt-4 rounded-lg bg-ivory-50 px-3 py-2 text-sm text-navy-800">{message}</p>}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>Title<input className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={180}/></label>
          <label className={labelClass}>URL slug<input className={inputClass} value={form.slug} onChange={(e) => set("slug", e.target.value)} maxLength={100}/></label>
          <label className={labelClass}>Category<input className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)} maxLength={80}/></label>
          <label className={labelClass}>Tags, comma separated<input className={inputClass} value={form.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))}/></label>
          <label className={`${labelClass} md:col-span-2`}>Description<textarea className={inputClass} rows={3} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} maxLength={500}/></label>
          <div className="md:col-span-2"><label className={labelClass}>Cover image</label><div className="mt-1 flex flex-wrap items-center gap-2"><input className="min-w-0 flex-1 rounded-lg border border-navy-950/15 px-3 py-2.5 text-sm" placeholder="Image URL or site path" value={form.image} onChange={(e) => set("image", e.target.value)}/><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-navy-950/15 px-3 py-2.5 text-sm"><Upload size={15}/>{busy === "upload" ? "Uploading…" : "Upload image"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy !== null} onChange={(e) => { void uploadImage(e.target.files?.[0]); e.currentTarget.value = ""; }}/></label></div>{form.image && <div className="mt-3 max-h-52 overflow-hidden rounded-xl bg-ivory-100"><img src={form.image} alt={form.imageAlt || "Cover preview"} className="max-h-52 w-full object-cover"/></div>}</div>
          <label className={labelClass}>Image description<input className={inputClass} value={form.imageAlt} onChange={(e) => set("imageAlt", e.target.value)} maxLength={220}/></label>
          <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Date label<input className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)}/></label><label className={labelClass}>Read time<input className={inputClass} value={form.readTime} onChange={(e) => set("readTime", e.target.value)}/></label></div>
        </div>

        <div className="mt-6 flex items-center justify-between"><h3 className="font-display text-lg">Article content</h3><button type="button" onClick={() => set("sections", [...form.sections, { heading: "", body: "" }])} className="text-sm font-semibold text-gold-700">+ Add section</button></div>
        <div className="mt-3 grid gap-3">{form.sections.map((section, index) => <div key={index} className="rounded-xl border border-navy-950/10 p-3"><div className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-navy-950/15 px-3 py-2 text-sm" placeholder={`Section ${index + 1} heading`} value={section.heading} onChange={(e) => set("sections", form.sections.map((item, i) => i === index ? { ...item, heading: e.target.value } : item))}/><button type="button" className="px-2 text-red-600" onClick={() => set("sections", form.sections.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div><textarea className="mt-2 w-full rounded-lg border border-navy-950/15 px-3 py-2 text-sm" rows={4} placeholder="Write this section…" value={section.body} onChange={(e) => set("sections", form.sections.map((item, i) => i === index ? { ...item, body: e.target.value } : item))}/></div>)}</div>
        <label className={`${labelClass} mt-4`}>Closing quote (optional)<textarea className={inputClass} rows={2} value={form.quote ?? ""} onChange={(e) => set("quote", e.target.value)}/></label>
      </>}
    </section>
  </div>;
}

