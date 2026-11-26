"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, Search, Sparkles, WandSparkles } from "lucide-react";

import { BLOG_POSTS } from "@/features/blog/posts";

export function BlogPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const posts = useMemo(() => BLOG_POSTS.filter((post) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || `${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(needle);
    return matchesQuery;
  }), [query]);

  async function generateDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError("");
    setDraft("");
    setDraftTitle("");
    try {
      const response = await fetch("/api/blog/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create a draft right now.");
      setDraft(result.draft);
      setDraftTitle(result.title || "Your blog draft");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a draft right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="blog-shell">
      <section className="blog-hero">
        <div className="blog-hero-copy">
          <span className="blog-eyebrow">The Wedding Blog</span>
          <h1>Ideas, Inspiration &amp;<br />Celebration Stories</h1>
          <p>Discover beautiful ideas, creative tips, and heartfelt stories for your special day.</p>
          <div className="blog-hero-rule"><span />✦<span /></div>
        </div>
        <div className="blog-hero-image">
          <Image className="blog-hero-foreground" src="/wedding-demo-royal.webp" alt="A flower-framed wedding mandap glowing with warm lights" fill priority sizes="(max-width: 760px) 100vw, 58vw" />
          <div className="blog-hero-shade" />
        </div>
      </section>

      <section className="blog-content">
        <div className="blog-toolbar">
          <label className="blog-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search blogs..." aria-label="Search blog posts" /></label>
        </div>

        <div className="blog-grid">
          {posts.map((post) => (
            <article className="blog-card" key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="blog-card-image">
                <Image src={post.image} alt={post.imageAlt} fill sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 33vw" />
                <span>{post.category}</span>
              </Link>
              <div className="blog-card-body">
                <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                <div className="blog-meta"><span><CalendarDays size={13} />{post.date}</span><span><Clock3 size={13} />{post.readTime}</span></div>
                <Link href={`/blog/${post.slug}`} className="blog-read-more">Read More <ArrowRight size={15} /></Link>
              </div>
            </article>
          ))}
          {!posts.length && <p className="blog-empty">No stories match that search. Try another word or category.</p>}
        </div>

        <section className="blog-ai-panel" id="ai-draft">
          <div className="blog-ai-intro"><span className="blog-ai-icon"><WandSparkles size={19} /></span><div><span className="blog-eyebrow">Optional writing assistant</span><h2>Start a story with AI</h2><p>Enter a wedding topic to create a blog draft. Review and edit it before using it anywhere.</p></div></div>
          <form onSubmit={generateDraft} className="blog-ai-form">
            <label htmlFor="blog-topic">What would you like to write about?</label>
            <div className="blog-ai-input-row"><input id="blog-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={300} placeholder="e.g. Planning a relaxed garden wedding" required /><button type="submit" disabled={loading || !topic.trim()}><Sparkles size={16} />{loading ? "Writing draft..." : "Generate draft by AI"}</button></div>
            <p className="blog-ai-note">Drafts are not saved or published. Gemini&rsquo;s free tier is preferred; if only OpenAI is configured, usage may be billed. Google may use free-tier prompts to improve its services, so avoid private details.</p>
          </form>
          {error && <p role="alert" className="blog-ai-error">{error}</p>}
          {draft && <div className="blog-draft" aria-live="polite"><h3>{draftTitle}</h3><pre>{draft}</pre></div>}
        </section>

        <section className="blog-promo">
          <div><span className="blog-eyebrow">Make it yours</span><h2>Turn Your Moments<br />Into Timeless Memories</h2><p>Create a beautiful celebration page to share your story.</p><Link href="https://everymomentwedding.netlify.app/templates?event=wedding" className="blog-promo-button">Create Your Invitation <ArrowRight size={15} /></Link></div>
          <div className="blog-promo-art"><Image src="/wedding-demo-royal.webp" alt="A romantic wedding mandap with flowers and candlelight" fill sizes="(max-width: 700px) 70vw, 58vw" /></div>
        </section>
      </section>
    </div>
  );
}

