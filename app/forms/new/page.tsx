import { redirect } from "next/navigation";

import { createDraftForm } from "@/services/custom-forms";

export const dynamic = "force-dynamic";

/**
 * Entry point for "Build a Form" (global nav link) — creates a brand-
 * new draft form with no login required, then redirects straight into
 * the builder at its private draft_token URL. Same shape as how the
 * event wizard's first step works (see features/start/), just without
 * any intermediate "choose an occasion" step since a form has nothing
 * to configure yet.
 */
export default async function NewFormPage() {
  const { token } = await createDraftForm();
  redirect(`/forms/build/${token}`);
}
