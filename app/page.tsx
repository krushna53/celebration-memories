import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlatformMarketingContent } from "@/features/platform/platform-marketing-content";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { logReferralVisit } from "@/services/referrals";
import { buildOrganizationJsonLd, buildWebsiteJsonLd, JsonLd } from "@/lib/structured-data";

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
  searchParams: Promise<{ ref?: string; code?: string }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const { ref, code } = await searchParams;

  // Safety net: a Supabase email-confirmation/magic-link redirect
  // should always land on /auth/callback (which exchanges this code
  // for a real session — see that route's doc comment), never here.
  // It only ends up on the bare homepage if Supabase's Redirect URL
  // allow-list rejected the intended destination and fell back to the
  // project's Site URL — which is exactly what happened before
  // emailRedirectTo was pointed at /auth/callback (see
  // features/forms/account-form.tsx's doc comment). Forwarding a
  // stray ?code= here rather than leaving it inert means a
  // confirmation link still works even if that allow-list is ever
  // out of date again.
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent("/login?verified=1")}`);
  }

  if (ref) {
    await logReferralVisit(ref);
  }

  return (
    <>
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildWebsiteJsonLd()} />
      <PlatformMarketingContent />
    </>
  );
}
