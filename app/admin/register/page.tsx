import { getEventById } from "@/services/events";
import { RegisterForm } from "@/features/admin/register/register-form";

export const dynamic = "force-dynamic";

interface AdminRegisterPageProps {
  searchParams: Promise<{ event?: string }>;
}

/**
 * Host registration — reached via a per-event link generated from
 * /admin/events ("Create Login" on a specific event's row, see
 * features/admin/events/event-list.tsx), e.g. /admin/register?event=<id>.
 *
 * Used to accept plain /admin/register with no event id at all, which
 * silently created a client-role admin with no event assigned — and
 * lib/admin-event.ts's resolveAdminEvent() used to fall back any such
 * admin to the single production event, meaning anyone who found this
 * page and verified an email got full edit access to the real client's
 * live Gallery/Timeline/Settings/etc. Both sides of that are fixed now:
 * this page refuses to render the signup form without a valid `?event=`
 * id, and resolveAdminEvent no longer has that fallback for client-role
 * admins regardless. See lib/admin-event.ts's doc comment for the full
 * story.
 */
export default async function AdminRegisterPage({ searchParams }: AdminRegisterPageProps) {
  const { event: eventIdParam } = await searchParams;

  if (!eventIdParam) {
    return <RegisterForm eventId={null} eventLabel={null} invalidEvent={false} />;
  }

  const event = await getEventById(eventIdParam).catch(() => null);
  if (!event) {
    return <RegisterForm eventId={null} eventLabel={null} invalidEvent />;
  }

  return <RegisterForm eventId={event.id} eventLabel={event.honoreeName} invalidEvent={false} />;
}
