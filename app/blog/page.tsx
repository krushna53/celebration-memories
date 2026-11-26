import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { BLOG_NAV_LINKS } from "@/features/blog/blog-nav";
import { BlogPage } from "@/features/blog/blog-page";

export const metadata: Metadata = {
  title: "Wedding Blog — Ideas, Inspiration & Celebration Stories | EveryMoment",
  description: "Wedding ideas, invitation inspiration, love stories, and celebration tips from EveryMoment.",
};

export default function BlogIndexPage() {
  return <SiteShell honoreeName="EveryMoment" navLinks={BLOG_NAV_LINKS}><BlogPage /></SiteShell>;
}

