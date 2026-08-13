import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Bare /forms has no page of its own — before this file existed, it
 * fell through to the marketplace's `[category]/page.tsx` catch-all
 * (any single path segment is treated as a category slug there),
 * rendering a confusing "Category not found" instead of anything
 * related to Build RSVP / Form. The nav link itself
 * (`lib/constants.ts`'s NAV_LINKS) already points straight at
 * /forms/new, so this just gives the bare URL — someone typing/
 * bookmarking "everymoment.in/forms" directly — the same destination
 * instead of a dead end.
 */
export default function FormsIndexPage(): never {
  redirect("/forms/new");
}
