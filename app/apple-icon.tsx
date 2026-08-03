import { ImageResponse } from "next/og";

/**
 * iOS "Add to Home Screen" icon — app/icon.svg already covers the
 * browser tab favicon via Next's file-convention route, but Safari on
 * iOS specifically looks for apple-icon (PNG, not SVG) when a guest
 * saves an event/invite link to their home screen. Rendered from the
 * same ring+dot mark as app/icon.svg rather than referencing that SVG
 * directly, since ImageResponse can't rasterize an external SVG file
 * — this recreates it with the same colors/geometry.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            backgroundImage: "linear-gradient(135deg, #4F46E5, #FF6B57)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
