import { requireOwner } from "@/services/admin-auth";
import { cashfreeSettings } from "@/services/cashfree-settings";
import { CashfreeForm } from "@/features/admin/billing/cashfree-form";
export const dynamic = "force-dynamic";
export default async function CashfreePage() {
  await requireOwner();
  const settings = await cashfreeSettings();
  return <div><h1 className="font-display text-2xl">Cashfree setup</h1>
    <p className="mt-3">In your Cashfree merchant dashboard, open Payment Gateway → Developers → API Keys. Start with Sandbox and copy its App ID and Secret Key here.</p>
    <p className="mt-3">Saving keys prepares the integration. It does not switch checkout or start charging customers. Merchant approval, domain verification, payment and webhook testing are required before activation.</p>
    <CashfreeForm appId={settings.appId} environment={settings.environment} configured={!!settings.secretKey} /></div>;
}
