import Link from "next/link";
import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { PrivacyRequestForm } from "@/features/privacy-requests/request-form";
export const metadata = { title: "Privacy requests | EveryMoment" };
export default function PrivacyRequestsPage() {
  return <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} footerVariant="minimal"><main className="mx-auto max-w-2xl px-4 pb-24 pt-32 text-navy-950">
    <h1 className="mb-4 font-display text-3xl">Your privacy request</h1>
    <p className="mb-6">Ask for access, correction, erasure, consent withdrawal, nomination or grievance review. No account is required. Requests are reviewed manually; submission does not immediately change or disclose data.</p>
    <PrivacyRequestForm />
    <p className="mt-6">Need help or want to follow up? <a className="underline" href="https://wa.me/919987982969?text=EveryMoment%20privacy%20request" target="_blank" rel="noopener noreferrer">Contact Krushna Web Works on WhatsApp</a> or use <Link href="/contact" className="underline">our contact form</Link>. Read the <Link href="/privacy" className="underline">Privacy Notice</Link>.</p>
  </main></SiteShell>;
}
