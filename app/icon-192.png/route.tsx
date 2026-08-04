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
 *
 * Note: this is a Route Handler (route.tsx), not Next's icon.tsx
 * convention — Route Handlers only permit HTTP method exports plus a
 * small fixed set of route-config exports (dynamic, revalidate,
 * runtime, etc.); a `contentType` export is only valid on the
 * icon.tsx/apple-icon.tsx convention and fails the build here with
 * "not a valid Route export field". ImageResponse already sets the
 * correct Content-Type response header on its own, so nothing extra
 * is needed.
 */

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
