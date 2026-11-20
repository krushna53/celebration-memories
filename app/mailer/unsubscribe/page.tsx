import { redirect } from "next/navigation";

import { describeUnsubscribe, unsubscribeByToken } from "@/services/mailer/live-mailer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/**
 * The unsubscribe link in every live Event Mailer email. Opening the link
 * only shows a confirm button — the actual unsubscribe is a POST, so email
 * security scanners that "click" links can't unsubscribe anyone by accident.
 * The token is signed (services/mailer/unsubscribe-token.ts); nothing else
 * from the URL is trusted.
 */

async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const token = formData.get("t");
  const ok = await unsubscribeByToken(token);
  redirect(ok ? `/mailer/unsubscribe?t=${encodeURIComponent(String(token))}&done=1` : "/mailer/unsubscribe?invalid=1");
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t, done } = await searchParams;
  const info = t ? await describeUnsubscribe(t) : null;

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#fafafb] px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-navy-950/10 bg-white p-6 text-center shadow-sm sm:p-8">
        {!info ? (
          <>
            <h1 className="font-display text-2xl text-navy-950">Link not valid</h1>
            <p className="mt-2 text-sm text-navy-700/70">This unsubscribe link is invalid or has expired. If you keep getting emails, reply to one and ask to be removed.</p>
          </>
        ) : done || !info.subscribed ? (
          <>
            <h1 className="font-display text-2xl text-navy-950">You&rsquo;re unsubscribed</h1>
            <p className="mt-2 text-sm text-navy-700/70">
              <strong>{info.maskedEmail}</strong> won&rsquo;t receive these emails any more.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl text-navy-950">Unsubscribe?</h1>
            <p className="mt-2 text-sm text-navy-700/70">
              Stop sending these emails to <strong>{info.maskedEmail}</strong>.
            </p>
            <form action={confirmUnsubscribe} className="mt-6">
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="inline-flex items-center justify-center rounded-full bg-navy-950 px-6 py-2.5 text-sm font-medium text-white hover:bg-navy-900">
                Unsubscribe
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
