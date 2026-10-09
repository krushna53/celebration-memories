import { protectTokenPage } from "@/services/event-page-access";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  await protectTokenPage("event_schedule_items", "share_token", token, `/session/${encodeURIComponent(token)}`);
  return <>{children}</>;
}
