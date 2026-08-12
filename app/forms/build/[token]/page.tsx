import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getFormByDraftToken, listFields } from "@/services/custom-forms";
import { FormBuilder } from "@/features/forms/form-builder";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

interface FormBuilderPageProps {
  params: Promise<{ token: string }>;
}

/**
 * The no-login form builder — reachable only by whoever holds this
 * exact URL (the form's draft_token). Bookmark this page to keep
 * editing later; there's no login involved unless you choose to create
 * an account after publishing, purely to get a dashboard for
 * responses. See services/custom-forms.ts's header comment for the
 * full trust model.
 */
export default async function FormBuilderPage({ params }: FormBuilderPageProps) {
  const { token } = await params;
  const form = await getFormByDraftToken(token);
  if (!form) notFound();

  const fields = await listFields(form.id);
  const publicUrl = `${SITE_URL}/f/${form.slug}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.35em] text-gold-500">Build a Form</p>
      <h1 className="mt-2 font-display text-2xl text-navy-950 sm:text-3xl">Design your form</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Bookmark this page — it&rsquo;s your private link to keep editing this form.
      </p>
      <div className="mt-6">
        <FormBuilder token={token} publicUrl={publicUrl} initialForm={form} initialFields={fields} />
      </div>
    </div>
  );
}
