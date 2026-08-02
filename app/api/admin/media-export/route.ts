import "server-only";
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

import { getCurrentAdmin, requireOwner } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { listMemoriesForModeration } from "@/services/admin-memories";

export const dynamic = "force-dynamic";

const EXPORTABLE_KINDS = new Set(["photo", "video", "audio"]);

/**
 * Streams a .zip of approved + pending photo/video/audio uploads for
 * whichever event the signed-in owner is currently managing (same
 * resolveAdminEvent() every other admin page uses — this used to be
 * hardcoded to the single flagship EVENT_SLUG event regardless of
 * which client event the owner had "stepped into" from /admin/events,
 * which meant the download silently pulled the wrong event's media).
 * Owner-only: bulk media export is an agency operations tool, not
 * something client/host accounts need — matches every other owner-only
 * admin surface (Invitees, Check-In, Referrals, Inquiries, Share Image).
 *
 * Optional `?kind=video` (or `photo`/`audio`) query param restricts the
 * export to just that media kind — e.g. the Memories page's "Download
 * All Videos" button — instead of always bundling everything.
 *
 * MVP-scoped: builds the whole zip in memory, which is fine for a
 * single family event's worth of uploads but won't scale to very large
 * media libraries — see the risk-analysis doc for the streaming/
 * background-job approach that would replace this at higher volume.
 */
export async function GET(request: NextRequest) {
  try {
    await requireOwner();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Not authorized." },
      { status: 403 },
    );
  }

  const admin = await getCurrentAdmin();
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return NextResponse.json({ error: "No event found." }, { status: 404 });
  }

  const kindParam = request.nextUrl.searchParams.get("kind");
  const kindFilter = kindParam && EXPORTABLE_KINDS.has(kindParam) ? kindParam : null;

  const items = (await listMemoriesForModeration(event.id, "all")).filter(
    (item) => item.kind !== "guestbook" && item.url && (!kindFilter || item.kind === kindFilter),
  );

  if (items.length === 0) {
    return NextResponse.json(
      { error: kindFilter ? `No ${kindFilter}s uploaded yet.` : "No media uploaded yet." },
      { status: 404 },
    );
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
