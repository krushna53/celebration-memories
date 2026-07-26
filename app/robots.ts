import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";

/** Keeps /admin and API routes out of search indexes; everything guest-facing stays crawlable. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/*", "/api/*"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
