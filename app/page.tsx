import type { Metadata } from "next";

import { PlatformMarketingContent } from "@/features/platform/platform-marketing-content";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { logReferralVisit } from "@/services/referrals";

/**
 * Site root — the platform's own marketing/info page, not any one
 * event. The original single-event experience now lives at
 * /events/[slug] alongside every other event (see
 * features/platform/platform-marketing-content.tsx for why this
 * changed, and app/platform/page.tsx, which now just redirects here).
 */
export const metadata: Metadata = {
  title: `${SITE_NAME} — Digital Invitations & Guest Memories`,
  description:
    "A premium, mobile-first invitation platform for birthdays, weddings, anniversaries, memorials, and more — unique guest links, live RSVP, and a shared wall of photos, videos, and messages.",
  alternates: { canonical: SITE_URL },
};

interface HomePageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const { ref } = await searchParams;
  if (ref) {
    await logReferralVisit(ref);
  }

  return <PlatformMarketingContent />;
}
