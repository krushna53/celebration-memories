import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listPromoCodes } from "@/services/promo-codes";
import { PromoCodeList } from "@/features/admin/promo-codes/promo-code-list";

export const dynamic = "force-dynamic";

export default async function AdminPromoCodesPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const codes = await listPromoCodes();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Promo Codes</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Codes hosts can redeem on the wizard&rsquo;s payment step to activate their event site
        for free instead of paying — good for early clients trying the platform.
      </p>
      <div className="mt-6">
        <PromoCodeList initialCodes={codes} />
      </div>
    </div>
  );
}
