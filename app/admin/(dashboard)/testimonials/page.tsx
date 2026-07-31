import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listAllTestimonials } from "@/services/testimonials";
import { TestimonialList } from "@/features/admin/testimonials/testimonial-list";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const testimonials = await listAllTestimonials();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Testimonials</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Stories submitted through the public{" "}
        <code className="rounded bg-navy-950/5 px-1 py-0.5">/testimonials/share</code> page. Approve one to show it
        in the homepage carousel, and optionally feature it to pin it first.
      </p>
      <div className="mt-6">
        <TestimonialList initialTestimonials={testimonials} />
      </div>
    </div>
  );
}
