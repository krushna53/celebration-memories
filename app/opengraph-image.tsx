import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/constants";

/**
 * Fallback Open Graph share-card image, used only when a page doesn't
 * generate its own (event pages already do — see lib/event-metadata.ts's
 * buildEventMetadata, which uses the organizer's real cover photo
 * instead). Without this file, pasting a link to a generic platform page
 * (homepage, /pricing, /business, /discover, ...) into WhatsApp/
 * Facebook/iMessage previously showed no image at all — just title +
 * description. Next.js's file-convention route (this file) generates
 * one automatically at build/request time for any page in this
 * directory tree that doesn't override it with its own
 * opengraph-image file or an explicit metadata.openGraph.images entry.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1e1b4b",
          backgroundImage: "linear-gradient(135deg, #1e1b4b 0%, #312a6b 100%)",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            backgroundImage: "linear-gradient(135deg, #4F46E5, #FF6B57)",
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: 44,
            fontSize: 84,
            fontWeight: 600,
            color: "#fdf6ec",
            letterSpacing: "-0.02em",
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ marginTop: 16, fontSize: 32, color: "#c7c2f0" }}>
          Digital Invitations &amp; Guest Memories
        </div>
      </div>
    ),
    { ...size },
  );
}
