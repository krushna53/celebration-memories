"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import { checkDomainAvailability, GoDaddyError, type DomainAvailabilityResult } from "@/lib/godaddy";

export type SearchDomainsResult =
  | { success: true; results: DomainAvailabilityResult[] }
  | { success: false; error: string };

// Available to both owner and client roles — this is the client-facing
// "get a custom domain for my event" tool, same auth shape as AI Image
// (see features/admin/ai-image/actions.ts). No spend happens here: this
// only checks availability/price via GoDaddy's read-only API, actual
// purchase happens on GoDaddy's own site via a deep link.
export async function searchDomainsAction(query: string): Promise<SearchDomainsResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  try {
    const results = await checkDomainAvailability(query);
    return { success: true, results };
  } catch (err) {
    if (err instanceof GoDaddyError) {
      return { success: false, error: err.message };
    }
    console.error("searchDomainsAction failed:", err);
    return { success: false, error: "Something went wrong searching domains. Please try again." };
  }
}
