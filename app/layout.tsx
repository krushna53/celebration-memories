import type { Metadata, Viewport } from "next";

import { playfair, poppins, dancingScript, baloo2, bebasNeue, inter } from "@/lib/fonts";
import { ACTIVE_EVENT, SITE_NAME } from "@/lib/constants";
import { ClarityScript } from "@/features/analytics/clarity-script";

import "./globals.css";

export const metadata: Metadata = {
  title: `${ACTIVE_EVENT.honoreeName} — ${ACTIVE_EVENT.eventTitle} | ${SITE_NAME}`,
  description: `Join us in celebrating ${ACTIVE_EVENT.honoreeName}'s 75th birthday, hosted by ${ACTIVE_EVENT.hostedBy}. ${ACTIVE_EVENT.dayOfWeek}, ${ACTIVE_EVENT.date}.`,
  metadataBase: new URL("https://celebration-memories.example.com"),
  openGraph: {
    title: `${ACTIVE_EVENT.honoreeName} — ${ACTIVE_EVENT.eventTitle}`,
    description: `Hosted by ${ACTIVE_EVENT.hostedBy} · ${ACTIVE_EVENT.dayOfWeek}, ${ACTIVE_EVENT.date}`,
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
      className={`${playfair.variable} ${poppins.variable} ${dancingScript.variable} ${baloo2.variable} ${bebasNeue.variable} ${inter.variable}`}
    >
      <body className="antialiased">
        {children}
        <ClarityScript />
      </body>
    </html>
  );
}
