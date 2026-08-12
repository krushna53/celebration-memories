import type { Metadata } from "next";

import { NewFormWizard } from "@/features/forms/new-form-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Entry point for "Build RSVP / Form" (global nav link) — a short wizard
 * (features/forms/new-form-wizard.tsx) that asks what kind of RSVP
 * this is and how to build it, before creating the draft form and
 * handing off to /forms/build/[token]. No login required at any step
 * — same draft_token trust model as the builder itself.
 */
export default function NewFormPage() {
  return (
    <div className="min-h-screen bg-ivory-100">
      <NewFormWizard />
    </div>
  );
}
