import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { BLOG_NAV_LINKS } from "@/features/blog/blog-nav";
import { getPublishedBlogPosts } from "@/services/blog";

/* eslint-disable @next/next/no-img-element -- Post cover URLs are owner-managed and may use arbitrary HTTPS image hosts. */

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const posts = await getPublishedBlogPosts();
  const post = posts.find((item) => item.slug === slug);
  return post ? { title: `${post.title} | EveryMoment Blog`, description: post.excerpt } : {};
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const posts = await getPublishedBlogPosts();
  const post = posts.find((item) => item.slug === slug);
  if (!post) notFound();
  const related = posts.filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <SiteShell honoreeName="EveryMoment" navLinks={BLOG_NAV_LINKS}>
      <article className="blog-article-page">
        <section className="blog-hero blog-article-hero">
          <div className="blog-hero-copy">
            <Link href="/blog" className="blog-back"><ArrowLeft size={14} /> All stories</Link>
            <span className="blog-eyebrow">{post.category}</span>
            <h1>{post.title}</h1>
            <p>{post.excerpt}</p>
            <div className="blog-meta blog-article-meta"><span><CalendarDays size={13} />{post.date}</span><span><Clock3 size={13} />{post.readTime}</span></div>
          </div>
          <div className="blog-hero-image" aria-hidden="true" />
          <div className="blog-hero-card blog-article-hero-card">
            <img src={post.image} alt={post.imageAlt} />
            {post.tags?.[0] && <div className="blog-article-cover-tags"><span>{post.tags[0]}</span></div>}
          </div>
        </section>
        <div className="blog-article-main">
          <div className="blog-article-copy">
            {post.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}
            {post.quote && <blockquote>{post.quote}</blockquote>}
          </div>
          <div className="blog-related"><h2>Related Stories</h2><div className="blog-related-grid">{related.map((item) => <Link className="blog-related-card" href={`/blog/${item.slug}`} key={item.slug}><span className="blog-related-image"><img src={item.image} alt={item.imageAlt} /></span><span className="blog-related-title">{item.title}</span><span className="blog-related-read">{item.readTime} <ArrowLeft size={13} /></span></Link>)}</div></div>
        </div>
      </article>
    </SiteShell>
  );
}

