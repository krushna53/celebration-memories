import type { Metadata } from "next";

import { BusinessSignupForm } from "@/features/business/signup-form";

/** Account-creation form, not a content page — kept out of search results so it doesn't compete with /business (the actual marketing page) for ranking. */
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function BusinessSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <BusinessSignupForm />
    </div>
  );
}
