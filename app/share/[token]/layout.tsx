import { protectTokenPage } from "@/services/event-page-access";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  await protectTokenPage("share_collections", "token", token, `/share/${encodeURIComponent(token)}`);
  return <>{children}</>;
}
