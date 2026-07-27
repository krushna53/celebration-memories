import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { getDraftEventByToken } from "@/services/event-drafts";

export const dynamic = "force-dynamic";

/**
 * Shared shell for every wizard step. Resolves the draft directly (not
 * via requireDraftEvent, which throws) so an invalid/already-claimed
 * link can show a friendly explanation instead of a crash — the most
 * common reason this happens is the host already finished the wizard
 * and paid, at which point getDraftEventByToken deliberately returns
 * null (see its doc comment in services/event-drafts.ts).
 */
export default async function WizardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const draft = await getDraftEventByToken(token);

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gold-500/20 bg-navy-900 p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-300">
            <AlertTriangle size={22} />
          </div>
          <h1 className="mt-4 font-display text-2xl text-ivory-50">Link no longer active</h1>
          <p className="mt-2 text-sm text-ivory-100/70">
            This setup link is invalid, or the event it belonged to has already
            been set up. If you&rsquo;ve already created an account, sign in to
            your dashboard instead.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/admin/login"
              className="rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110"
            >
              Sign in
            </Link>
            <Link href="/start" className="text-sm text-gold-300 underline underline-offset-4 hover:text-gold-200">
              Start a new event
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-ivory-50">{children}</div>;
}
