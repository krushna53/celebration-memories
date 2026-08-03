import { ImageResponse } from "next/og";

/** PWA manifest icon (512x512) — see app/icon-192.png/route.tsx's doc comment. */
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
            width: 284,
            height: 284,
            borderRadius: "50%",
            backgroundImage: "linear-gradient(135deg, #4F46E5, #FF6B57)",
            display: "flex",
          }}
        />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
