import { notFound } from "next/navigation";

import { getDraftEventByToken } from "@/services/event-drafts";
import { AccountForm } from "@/features/start/account-form";

export const dynamic = "force-dynamic";

export default async function WizardAccountPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <AccountForm token={token} eventId={event.id} />
    </div>
  );
}
