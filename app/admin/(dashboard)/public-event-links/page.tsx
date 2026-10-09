import { requireOwner } from "@/services/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/constants";
import { PublicLinksPanel } from "@/features/privacy/public-links-panel";
export const dynamic = "force-dynamic";
export default async function PublicEventLinksPage() {
  await requireOwner();
  const { data, error } = await supabaseAdmin().from("events").select("slug,honoree_name,public_access_pinned,viewing_access,page_status").eq("status", "active").order("created_at", { ascending: false });
  if (error) throw new Error("Could not load public event links.");
  return <div className="text-navy-950"><h1 className="mb-6 font-display text-2xl">Public Event Links</h1><PublicLinksPanel events={data ?? []} siteUrl={SITE_URL} /></div>;
}
