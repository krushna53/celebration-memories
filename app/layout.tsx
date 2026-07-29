import type { Metadata, Viewport } from "next";

import {
  playfair,
  poppins,
  dancingScript,
  baloo2,
  bebasNeue,
  inter,
  righteous,
  ebGaramond,
  cormorantGaramond,
  quicksand,
} from "@/lib/fonts";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { ClarityScript } from "@/features/analytics/clarity-script";

import "./globals.css";

/**
 * Platform-generic defaults only — deliberately NOT tied to any one
 * client's event (previously hardcoded to ACTIVE_EVENT / "Mahesh J.
 * Shah", which leaked that client's name and details into the <title>
 * and Open Graph tags of every route that doesn't set its own metadata,
 * including the platform homepage). Every event page already generates
 * its own per-event metadata (see app/events/[slug]/page.tsx's
 * generateMetadata) which fully overrides this; this is purely the
 * fallback for platform-level routes like /, /events, /roles, /contact.
 */
export const metadata: Metadata = {
  title: `${SITE_NAME} — Digital Invitations & Guest Memories`,
  description:
    "A premium, mobile-first invitation platform for birthdays, weddings, anniversaries, memorials, and more — unique guest links, live RSVP, and a shared wall of photos, videos, and messages.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: SITE_NAME,
    description: "Premium digital invitations and shared guest memories for any celebration.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1626",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${poppins.variable} ${dancingScript.variable} ${baloo2.variable} ${bebasNeue.variable} ${inter.variable} ${righteous.variable} ${ebGaramond.variable} ${cormorantGaramond.variable} ${quicksand.variable}`}
    >
      <body className="antialiased">
        {children}
        <ClarityScript />
      </body>
    </html>
  );
}
