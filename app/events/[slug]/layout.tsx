import { protectTokenPage } from "@/services/event-page-access";
export const dynamic = "force-dynamic";
export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await protectTokenPage("events", "slug", slug, `/events/${encodeURIComponent(slug)}`);
  return <>{children}</>;
}
