import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileX2 } from "lucide-react";

import { getFormBySlug, listFields } from "@/services/custom-forms";
import { PublicFormFill } from "@/features/forms/public-form-fill";

export const dynamic = "force-dynamic";

interface PublicFormPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ regId?: string }>;
}

export async function generateMetadata({ params }: PublicFormPageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = await getFormBySlug(slug);
  return {
    title: form ? form.title : "Form",
    robots: { index: false, follow: false },
  };
}

/**
 * Public, no-login form-fill page — the link a form's builder shares
 * out. A "draft" form 404s here (never publicly reachable before the
 * builder explicitly publishes); a "closed" form shows a friendly
 * message instead of the fields, so an old shared link doesn't just
 * silently break.
 */
export default async function PublicFormPage({ params, searchParams }: PublicFormPageProps) {
  const { slug } = await params;
  const { regId } = await searchParams;
  const form = await getFormBySlug(slug);

  if (!form || form.status === "draft") {
    notFound();
  }

  if (form.status === "closed") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <FileX2 className="text-navy-700/30" size={40} />
        <h1 className="mt-4 font-display text-xl text-navy-950">{form.title}</h1>
        <p className="mt-2 text-sm text-navy-700/60">This form is no longer accepting responses.</p>
      </div>
    );
  }

  const fields = await listFields(form.id);

  return (
    <div className="min-h-screen bg-ivory-50 py-12">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        {form.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.coverImageUrl} alt="" className="mb-6 h-48 w-full rounded-2xl object-cover" />
        ) : null}
        <h1 className="font-display text-2xl text-navy-950 sm:text-3xl">{form.title}</h1>
        {form.description ? <p className="mt-2 text-sm text-navy-700/70">{form.description}</p> : null}

        <div className="mt-6">
          <PublicFormFill formId={form.id} fields={fields} sessionRegistrationId={regId ?? null} />
        </div>
      </div>
    </div>
  );
}
