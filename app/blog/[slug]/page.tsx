import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { BLOG_NAV_LINKS } from "@/features/blog/blog-nav";
import { BLOG_POSTS } from "@/features/blog/posts";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return BLOG_POSTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((item) => item.slug === slug);
  return post ? { title: `${post.title} | EveryMoment Blog`, description: post.excerpt } : {};
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((item) => item.slug === slug);
  if (!post) notFound();
  const related = BLOG_POSTS.filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <SiteShell honoreeName="EveryMoment" navLinks={BLOG_NAV_LINKS}>
      <article className="blog-article-page">
        <div className="blog-article-cover"><Image src="/wedding-demo-royal.webp" alt="A flower-framed Indian wedding mandap glowing at night" fill priority sizes="100vw" /></div>
        <div className="blog-article-main">
          <Link href="/blog" className="blog-back"><ArrowLeft size={16} /> All stories</Link>
          <span className="blog-article-category">{post.category}</span>
          <h1>{post.title}</h1>
          <p className="blog-article-excerpt">{post.excerpt}</p>
          <div className="blog-meta blog-article-meta"><span><CalendarDays size={14} />{post.date}</span><span><Clock3 size={14} />{post.readTime}</span></div>
          <div className="blog-article-inline-frame"><Image className="blog-article-inline-image" src={post.image} alt={post.imageAlt} fill sizes="(max-width: 870px) 100vw, 870px" /></div>
          <div className="blog-article-copy">
            {post.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}
            {post.quote && <blockquote>{post.quote}</blockquote>}
          </div>
          <div className="blog-related"><h2>Related Stories</h2><div className="blog-related-grid">{related.map((item) => <Link className="blog-related-card" href={`/blog/${item.slug}`} key={item.slug}><span className="blog-related-image"><Image src={item.image} alt={item.imageAlt} fill sizes="(max-width: 700px) 100vw, 30vw" /></span><span className="blog-related-title">{item.title}</span><span className="blog-related-read">{item.readTime} <ArrowLeft size={13} /></span></Link>)}</div></div>
        </div>
      </article>
    </SiteShell>
  );
}

