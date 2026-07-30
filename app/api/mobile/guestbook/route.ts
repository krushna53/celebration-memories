import "server-only";
import { NextResponse } from "next/server";

import { getInviteeByToken } from "@/services/invitees";
import { submitGuestbookEntry } from "@/services/guestbook";
import { guestbookFormSchema } from "@/types/guestbook";

export const dynamic = "force-dynamic";

/**
 * Public, token-gated Guest Book submission for the companion mobile
 * app. Same trust boundary and shared-schema approach as
 * ../rsvp/route.ts. An optional `photoStoragePath` may be attached —
 * the mobile client uploads that photo first via
 * ../upload/request + ../upload/confirm (kind: "photo"), then passes
 * the resulting storage path here, mirroring how the web Guest Book
 * form's optional photo field works.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token, photoStoragePath, ...formFields } = (body ?? {}) as {
    token?: string;
    photoStoragePath?: string | null;
  };
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing invitation token." }, { status: 400 });
  }

  const found = await getInviteeByToken(token);
  if (!found) {
    return NextResponse.json({ error: "This invitation link is not valid." }, { status: 404 });
  }

  const parsed = guestbookFormSchema.safeParse(formFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check your message." },
      { status: 422 },
    );
  }

  try {
    await submitGuestbookEntry({
      inviteeId: found.invitee.id,
      eventId: found.event.id,
      values: parsed.data,
      photoPath: photoStoragePath ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save your message." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
