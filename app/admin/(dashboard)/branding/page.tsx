import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getHostBrand } from "@/services/host-brands";
import { BrandForm } from "@/features/admin/branding/brand-form";

export const dynamic = "force-dynamic";

/**
 * Agency branding (services/host-brands.ts) — set once per host account
 * and shown on every event it owns. Only the host's own account (client
 * role, or the platform owner) can open it.
 */
export default async function AdminBrandingPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  if (admin.role !== "client" && admin.role !== "owner") redirect("/admin");

  const brand = await getHostBrand(admin.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Branding</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Running events for clients? Add your agency&rsquo;s name, website and logo once — they appear as &ldquo;Event
        powered by&rdquo; on every event site and invite page you own, and in the dashboard header for your clients.
      </p>
      <div className="mt-6">
        <BrandForm
          exists={Boolean(brand)}
          initial={{
            displayName: brand?.displayName ?? "",
            websiteUrl: brand?.websiteUrl ?? "",
            logoUrl: brand?.logoUrl ?? null,
            applyToEvents: brand?.applyToEvents ?? true,
          }}
        />
      </div>
    </div>
  );
}
