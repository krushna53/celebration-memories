import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { getDraftEventByToken } from "@/services/event-drafts";
import { getCurrentAdmin } from "@/services/admin-auth";
import { AccountForm } from "@/features/start/account-form";
import { linkDraftEventFormAction } from "@/features/start/actions/event";
import { signOutAction } from "@/features/admin/auth-actions";

export const dynamic = "force-dynamic";

interface WizardAccountPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ linkError?: string }>;
}

export default async function WizardAccountPage({ params, searchParams }: WizardAccountPageProps) {
  const { token } = await params;
  const { linkError } = await searchParams;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  // A visitor who's already signed in as an admin (most commonly: sent
  // here from /admin/simple or /admin because their existing account
  // has no event linked yet) shouldn't go through AccountForm's
  // signUp() — that flow has no idea a session already exists and
  // would either fail with "already registered" or create a second,
  // orphaned identity. Offer to link this draft to their existing
  // account instead; only admins already scoped to a different event
  // are turned away (linkDraftEventToExistingAdminAction re-checks
  // this server-side regardless of what's shown here).
  const admin = await getCurrentAdmin();

  if (admin && !admin.eventId) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <div className="rounded-2xl border border-navy-950/10 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
            <CheckCircle2 size={22} />
          </div>
          <h1 className="mt-4 font-display text-2xl text-navy-950">Link This Event to Your Account</h1>
          <p className="mt-2 text-sm text-navy-700/60">
            You&rsquo;re signed in as <strong className="text-navy-950">{admin.email}</strong>, which
            isn&rsquo;t linked to an event yet. Link it to what you just built here, no new account needed.
          </p>
          {linkError ? (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">
              {linkError}
            </p>
          ) : null}
          <form action={linkDraftEventFormAction.bind(null, token)} className="mt-6">
            <button
              type="submit"
              className="tap-target w-full rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110"
            >
              Link Event to {admin.email}
            </button>
          </form>
          <form action={signOutAction} className="mt-3">
            <button type="submit" className="text-sm text-navy-700/60 underline underline-offset-4 hover:text-navy-950">
              Not you? Sign out and create a new account
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (admin) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <div className="rounded-2xl border border-navy-950/10 bg-white p-8 text-center">
          <h1 className="font-display text-2xl text-navy-950">Already Signed In</h1>
          <p className="mt-2 text-sm text-navy-700/60">
            You&rsquo;re signed in as <strong className="text-navy-950">{admin.email}</strong>, which already
            manages a different event. Sign out first if you meant to create a separate account for this one.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-medium text-navy-950 transition-luxury duration-200 hover:brightness-110"
          >
            Go to Your Dashboard
          </Link>
          <form action={signOutAction} className="mt-3">
            <button type="submit" className="text-sm text-navy-700/60 underline underline-offset-4 hover:text-navy-950">
              Sign out and create a new account
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <AccountForm token={token} eventId={event.id} />
    </div>
  );
}
