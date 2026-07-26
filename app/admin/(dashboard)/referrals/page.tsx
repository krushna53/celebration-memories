import { listReferralCodes } from "@/services/referrals";
import { ReferralManager } from "@/features/admin/referrals/referral-manager";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const codes = await listReferralCodes();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Referrals</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Give people a link to share in their WhatsApp groups. Track visits
        automatically; log conversions and reward payouts manually.
      </p>
      <div className="mt-6">
        <ReferralManager initialCodes={codes} />
      </div>
    </div>
  );
}
