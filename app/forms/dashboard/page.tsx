import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";

import { getCurrentFormOwner, listFormsForOwner } from "@/services/custom-forms";
import { FORM_CATEGORY_LABELS, isRsvpCategory } from "@/lib/form-category";
import { SignOutButton } from "@/features/forms/sign-out-button";
import { DashboardRoleToggle } from "@/features/forms/dashboard-role-toggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Every form this account owns — the landing page after signing in at
 * /forms/login or right after creating an account from the builder.
 * New accounts default to role "rsvp" (form_owners.role's DB default,
 * migration 0051) — the list is filtered down to RSVP-category forms
 * only until the account switches to "owner" (self-service toggle,
 * see features/forms/dashboard-role-toggle.tsx), which sees
 * everything. Filtered in-memory rather than in the query — the
 * per-owner form count is small, and listFormsForOwner stays a single
 * reusable "everything this account owns" query for every caller.
 */
export default async function FormsDashboardPage() {
  const owner = await getCurrentFormOwner();
  if (!owner) redirect("/forms/login");

  const allForms = await listFormsForOwner(owner.id);
  const forms = owner.role === "rsvp" ? allForms.filter((form) => isRsvpCategory(form.category)) : allForms;

  return (
    <div className="min-h-screen bg-ivory-100">
      <header className="border-b border-navy-950/10 bg-navy-950 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <p className="font-display text-lg text-gold-300">Your Forms</p>
            <p className="text-xs text-ivory-100/50">{owner.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DashboardRoleToggle role={owner.role} />
          <Link
            href="/forms/new"
            className="flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110"
          >
            <Plus size={15} /> New Form
          </Link>
        </div>

        <p className="mt-4 text-sm text-navy-700/60">{forms.length} form{forms.length === 1 ? "" : "s"}</p>

        <div className="mt-2 grid gap-3">
          {forms.map((form) => (
            <Link
              key={form.id}
              href={`/forms/dashboard/${form.id}`}
              className="flex items-center gap-3 rounded-xl border border-navy-950/10 bg-white px-4 py-3.5 transition-luxury duration-200 hover:border-gold-500/40"
            >
              <FileText size={18} className="shrink-0 text-gold-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy-950">{form.title}</p>
                <p className="text-xs text-navy-700/50">
                  <span className="capitalize">{form.status}</span>
                  {" · "}
                  {FORM_CATEGORY_LABELS[form.category ?? "general"]}
                </p>
              </div>
            </Link>
          ))}
          {forms.length === 0 ? (
            <p className="rounded-xl border border-dashed border-navy-950/15 bg-white p-8 text-center text-sm text-navy-700/50">
              {owner.role === "rsvp" && allForms.length > 0
                ? "No RSVP-category forms yet — switch to “All Forms” to see everything, or create a new RSVP form."
                : "No forms yet — create one to get started."}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
