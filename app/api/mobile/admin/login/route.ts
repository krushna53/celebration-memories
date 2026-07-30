import "server-only";
import { NextResponse } from "next/server";

import { loginWithMobileAccessCode } from "@/services/admin-mobile-auth";

export const dynamic = "force-dynamic";

/**
 * Exchanges a human-typed mobile access code (see
 * services/admin-mobile-auth.ts and features/admin/mobile-access — an
 * admin generates this from /admin/simple) for a long-lived session
 * token the app stores in SecureStore. Deliberately not the web admin's
 * email/password — see admin-mobile-auth.ts's file comment for why.
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

  const result = await loginWithMobileAccessCode(code);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({ sessionToken: result.sessionToken, admin: result.admin });
}
