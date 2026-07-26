import "server-only";
import { NextResponse } from "next/server";
import JSZip from "jszip";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getEventBySlug } from "@/services/events";
import { listMemoriesForModeration } from "@/services/admin-memories";
import { EVENT_SLUG } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Streams a .zip of every approved + pending photo/video/audio upload
 * for the site's primary event, so the admin can back up guest media
 * without opening each file individually. Admin-gated.
 *
 * MVP-scoped: builds the whole zip in memory, which is fine for a
 * single family event's worth of uploads but won't scale to very large
 * media libraries — see the risk-analysis doc for the streaming/
 * background-job approach that would replace this at higher volume.
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const event = await getEventBySlug(EVENT_SLUG);
  if (!event) {
    return NextResponse.json({ error: "No event found." }, { status: 404 });
  }

  const items = (await listMemoriesForModeration(event.id, "all")).filter(
    (item) => item.kind !== "guestbook" && item.url,
  );

  if (items.length === 0) {
    return NextResponse.json({ error: "No media uploaded yet." }, { status: 404 });
  }

  const zip = new JSZip();

  await Promise.all(
    items.map(async (item, index) => {
      try {
        const res = await fetch(item.url!);
        if (!res.ok) return;
        const buffer = Buffer.from(await res.arrayBuffer());
        const pathname = new URL(item.url!).pathname;
        const ext = pathname.split(".").pop()?.toLowerCase() || "bin";
        const safeGuestName =
          item.guestName.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "guest";
        zip.file(`${item.kind}/${safeGuestName}-${index}.${ext}`, buffer);
      } catch (err) {
        console.error("media-export: failed to fetch", item.url, err);
      }
    }),
  );

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="celebration-memories-${event.slug}-media.zip"`,
    },
  });
}
