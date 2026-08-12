import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { getCurrentFormOwner, getFormById, listFields, listResponses } from "@/services/custom-forms";
import { ResponseManager } from "@/features/forms/response-manager";
import { FormStatusControl } from "@/features/forms/form-status-control";
import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

interface FormDashboardPageProps {
  params: Promise<{ formId: string }>;
}

export default async function FormDashboardPage({ params }: FormDashboardPageProps) {
  const { formId } = await params;
  const owner = await getCurrentFormOwner();
  if (!owner) redirect("/forms/login");

  const form = await getFormById(formId);
  if (!form || form.ownerId !== owner.id) notFound();

  const [fields, responses] = await Promise.all([listFields(formId), listResponses(formId)]);

  return (
    <div className="min-h-screen bg-ivory-100">
      <header className="border-b border-navy-950/10 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/forms/dashboard" className="flex items-center gap-1.5 text-xs text-navy-700/50 hover:text-navy-950">
            <ArrowLeft size={13} /> All Forms
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl text-navy-950">{form.title}</h1>
              <p className="text-xs text-navy-700/50">{responses.length} response{responses.length === 1 ? "" : "s"}</p>
            </div>
            <FormStatusControl formId={form.id} status={form.status} publicUrl={`${SITE_URL}/f/${form.slug}`} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ResponseManager formId={form.id} fields={fields} initialResponses={responses} />
      </main>
    </div>
  );
}
