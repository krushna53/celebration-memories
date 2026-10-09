import { protectTokenPage } from "@/services/event-page-access";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  await protectTokenPage("events", "event_day_share_token", token, `/event-day/${encodeURIComponent(token)}`);
  return <>{children}</>;
}
