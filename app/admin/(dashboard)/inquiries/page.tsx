import { listInquiries } from "@/services/inquiries";
import { InquiryList } from "@/features/admin/inquiries/inquiry-list";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  const inquiries = await listInquiries();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Inquiries</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Messages submitted through the public Contact Us page.
      </p>
      <div className="mt-6">
        <InquiryList initialInquiries={inquiries} />
      </div>
    </div>
  );
}
