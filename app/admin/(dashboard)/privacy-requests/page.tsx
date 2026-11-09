import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/services/admin-auth";
import { listPrivacyRequests } from "@/services/privacy-requests";
import { PrivacyReviewForm } from "@/features/privacy-requests/review-form";
import type { RequestStatus } from "@/types/privacy-request";
export const dynamic = "force-dynamic";
export default async function PrivacyRequestQueue({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if ((await getCurrentAdmin())?.role !== "owner") redirect("/admin");
  const raw = Number((await searchParams).page ?? 0);
  const page = Number.isSafeInteger(raw) && raw >= 0 && raw <= 10000 ? raw : 0;
  const requests = await listPrivacyRequests(page);
  return <div className="max-w-3xl space-y-5 text-navy-950">
    <h1 className="font-display text-2xl">Privacy requests</h1>
    <p>Verify identity and authority before accessing or changing data. Status changes record manual work; they do not erase data, contact processors or send replies. Contact the requester yourself and record fulfilment before completing a request.</p>
    {requests.length === 0 ? <p>No requests on this page.</p> : null}
    {requests.map((request) => <article key={request.id} className="rounded border bg-white p-5">
      <h2 className="font-semibold">{request.kind} · {request.status}</h2>
      <p className="break-all text-xs">Reference: {request.id}</p>
      <p>{request.email} · {request.event_label}</p>
      <p className="text-xs">Received: {new Date(request.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
      <p className="mt-3 whitespace-pre-wrap break-words">{request.details}</p>
      {request.review_note ? <p className="mt-3 whitespace-pre-wrap">Last review: {request.review_note}</p> : null}
      <details className="mt-3"><summary>Review history</summary>
        {request.privacy_request_history.map((entry) => <div key={entry.id} className="mt-2 border-t pt-2 text-sm">
          <p>{entry.status} · {new Date(entry.recorded_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          <p className="whitespace-pre-wrap">{entry.note}</p>
          {entry.verification ? <p className="whitespace-pre-wrap">Verification: {entry.verification}</p> : null}
        </div>)}
      </details>
      <PrivacyReviewForm id={request.id} status={request.status as RequestStatus} verification={request.verification} />
    </article>)}
    <nav aria-label="Request pages" className="flex gap-4">{page > 0 ? <Link href={`/admin/privacy-requests?page=${page - 1}`}>Previous</Link> : null}{requests.length === 25 ? <Link href={`/admin/privacy-requests?page=${page + 1}`}>Next</Link> : null}</nav>
  </div>;
}
