import "server-only";
import { NextResponse } from "next/server";

import { loginWithBusinessMobileAccessCode } from "@/services/business-mobile-auth";

export const dynamic = "force-dynamic";

/**
 * Exchanges a human-typed vendor mobile access code (generated from
 * /business/dashboard, see features/business/mobile-access) for a
 * long-lived session token — same pattern as /api/mobile/admin/login,
 * deliberately not the vendor's web email/password.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { code } = (body ?? {}) as { code?: string };
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Please enter your access code." }, { status: 400 });
  }

  const result = await loginWithBusinessMobileAccessCode(code);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({ sessionToken: result.sessionToken, account: result.account });
}
