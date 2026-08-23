import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listConciergeInquiries } from "@/services/concierge";
import { ConciergeInquiriesTable } from "@/features/admin/concierge/concierge-inquiries-table";

export const metadata: Metadata = { title: "Concierge Leads — Admin" };

export default async function ConciergeInquiriesPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "owner") redirect("/admin");

  const inquiries = await listConciergeInquiries();

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy-950">Concierge Leads</h1>
        <p className="mt-1 text-sm text-navy-700/60">
          Phone numbers submitted via the &quot;Need help?&quot; banner. Click the WhatsApp icon to reach out.
        </p>
      </div>
      <ConciergeInquiriesTable inquiries={inquiries} />
    </div>
  );
}
