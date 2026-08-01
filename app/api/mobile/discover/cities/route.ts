import "server-only";
import { NextResponse } from "next/server";

import { listAllCities } from "@/services/marketplace-categories";

export const dynamic = "force-dynamic";

/** City filter list for the mobile Discover screens. Public, no auth. */
export async function GET() {
  const cities = await listAllCities();
  return NextResponse.json({ cities });
}
