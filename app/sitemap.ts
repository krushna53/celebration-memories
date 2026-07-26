import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";
import { listPublicEvents } from "@/services/events";

/**
 * Static routes + every public event, generated at request time (not
 * cached at build time) so newly-approved public events show up without
 * a redeploy. Private events are deliberately excluded — they're only
 * reachable via their direct link, matching how /events (the public
 * directory) already treats them.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/events`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/roles`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/guide`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/templates/submit`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  let eventRoutes: MetadataRoute.Sitemap = [];
  try {
    const events = await listPublicEvents();
    eventRoutes = events.map((event) => ({
      url: `${SITE_URL}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.error("sitemap failed to load public events:", err);
  }

  return [...staticRoutes, ...eventRoutes];
}
