import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";

import type { BlogPost } from "@/features/blog/posts";

export function BlogPage({ posts: allPosts }: { posts: BlogPost[] }) {
  const posts = allPosts;

  return (
    <div className="blog-shell">
      <section className="blog-hero">
        <div className="blog-hero-copy">
          <span className="blog-eyebrow">The Wedding Blog</span>
          <h1>Ideas, Inspiration &amp;<br />Celebration Stories</h1>
          <p>Discover beautiful ideas, creative tips, and heartfelt stories for your special day.</p>
          <div className="blog-hero-rule"><span />✦<span /></div>
        </div>
        <div className="blog-hero-image" aria-hidden="true" />
        <div className="blog-hero-card" role="img" aria-label="A newly married couple together in traditional wedding attire">
          <Image className="blog-hero-card-image" src="/art/couples/couple-rajasthani-gulabi.webp" alt="" fill priority sizes="(max-width: 760px) 200px, 320px" />
        </div>
      </section>

      <section className="blog-content">
        <div className="blog-grid">
          {posts.map((post) => (
            <article className="blog-card" key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="blog-card-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.image} alt={post.imageAlt} />
                {post.tags?.[0] ? <span className="blog-card-tags"><span>{post.tags[0]}</span></span> : null}
              </Link>
              <div className="blog-card-body">
                <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
                <div className="blog-meta"><span><CalendarDays size={13} />{post.date}</span><span><Clock3 size={13} />{post.readTime}</span></div>
                <Link href={`/blog/${post.slug}`} className="blog-read-more">Read More <ArrowRight size={15} /></Link>
              </div>
            </article>
          ))}
          {!posts.length && <p className="blog-empty">New stories are coming soon.</p>}
        </div>

        <section className="blog-promo">
          <div><span className="blog-eyebrow">Make it yours</span><h2>Turn Your Moments<br />Into Timeless Memories</h2><p>Create a beautiful celebration page to share your story.</p><Link href="https://everymomentwedding.netlify.app/templates?event=wedding" className="blog-promo-button">Create Your Invitation <ArrowRight size={15} /></Link></div>
          <div className="blog-promo-art"><Image src="/wedding-demo-royal.webp" alt="A romantic wedding mandap with flowers and candlelight" fill sizes="(max-width: 700px) 70vw, 58vw" /></div>
        </section>
      </section>
    </div>
  );
}

