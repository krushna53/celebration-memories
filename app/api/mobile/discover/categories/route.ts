import "server-only";
import { NextResponse } from "next/server";

import { listCategoryTree } from "@/services/marketplace-categories";

export const dynamic = "force-dynamic";

/** Category tree (top-level + subcategories) for the mobile app's Discover browse screen — mirrors app/discover/page.tsx's data source. Public, no auth. */
export async function GET() {
  const categories = await listCategoryTree();
  return NextResponse.json({ categories });
}
