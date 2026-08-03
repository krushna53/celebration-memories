import { ImageResponse } from "next/og";

/**
 * PWA manifest icon (192x192) — referenced by app/manifest.ts. Same
 * ring/dot mark language as app/apple-icon.tsx (recreated with
 * ImageResponse rather than rasterizing app/icon.svg directly, for the
 * same reason apple-icon.tsx already does this), just at the size
 * Chrome/Android's manifest icon requirements call for. A plain route
 * handler (not Next's icon.tsx convention) since that convention only
 * generates a single favicon-purpose icon, not an arbitrary manifest
 * icon set.
 */
export const contentType = "image/png";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1e1b4b",
        }}
      >
        <div
          style={{
            width: 107,
            height: 107,
            borderRadius: "50%",
            backgroundImage: "linear-gradient(135deg, #4F46E5, #FF6B57)",
            display: "flex",
          }}
        />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
