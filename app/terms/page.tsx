import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUILDER, SITE_NAME } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata = {
  title: `Terms & Conditions — ${"Celebration Memories"}`,
  description: "The terms that apply to using Celebration Memories and purchasing a plan.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Who this applies to",
    body: `These terms apply to anyone who creates an event site on ${SITE_NAME} ("the platform," "we," "us"), whether on the Free plan or a paid Premium/Pro plan (see /pricing for current plan details). ${SITE_NAME} is built and operated by ${BUILDER.name}.`,
  },
  {
    title: "The service",
    body: "We provide a self-serve tool to build and host a digital invitation and memory-sharing site for a personal or corporate celebration — RSVP collection, a photo/video/audio gallery, a guestbook, and related features described on the plan you choose. Features, limits, and available templates may be added, changed, or retired over time; we'll make a reasonable effort to communicate material changes affecting an active plan.",
  },
  {
    title: "Accounts and plans",
    body: "You can build and preview a site with no account at all (see /start). An account is only required to publish a site and keep it live, at which point a plan applies — Free, Premium, or Pro, billed monthly, annually, or as a one-time payment depending on what's offered at checkout. You're responsible for keeping your login credentials confidential and for all activity under your account.",
  },
  {
    title: "Payment",
    body: "Paid plans are processed by a third-party payment processor (Razorpay and/or Stripe, depending on what's configured) or, where offered, by direct UPI/bank transfer confirmed manually. We never see or store your card, UPI, or bank credentials — they're handled entirely by the payment processor. Prices are shown in USD and INR for reference; the amount actually charged is the one shown at checkout in your selected currency.",
  },
  {
    title: "Promo codes",
    body: "Promo codes (e.g., a launch offer) may grant free or discounted access, are limited in number of redemptions, may be withdrawn or expire at any time, and have no cash value.",
  },
  {
    title: "Your content",
    body: "You (the host) and the guests you invite retain ownership of everything uploaded — photos, videos, audio, RSVP details, and guestbook messages. By uploading content you grant us a limited license to store, process (e.g., compress images, generate thumbnails), and display it back to you and the guests you've given access to, solely to provide the service. You're responsible for having the right to share any content you upload and for moderating guest submissions before they appear publicly (approval is required by default).",
  },
  {
    title: "Acceptable use",
    body: "Don't use the platform to upload unlawful, infringing, or harmful content, to harass anyone, or to attempt to access another host's event or account without authorization. We may suspend or remove content or accounts that violate this.",
  },
  {
    title: "Service availability",
    body: "We aim for reliable uptime but don't guarantee the service will be uninterrupted or error-free, and we're not liable for losses arising from downtime, third-party service outages (hosting, storage, payment, or AI providers we depend on), or content lost due to circumstances outside our reasonable control. Keep your own copies of anything irreplaceable.",
  },
  {
    title: "Cancellation and refunds",
    body: "See our separate Cancellation & Refund Policy for how to cancel a plan and what's refundable.",
  },
  {
    title: "Changes to these terms",
    body: "We may update these terms from time to time; continued use of an active plan after an update constitutes acceptance of the revised terms. Material changes will be reflected here with an updated effective date.",
  },
  {
    title: "Contact",
    body: "Questions about these terms can be sent via the Contact Us page or the WhatsApp link in the footer.",
  },
];

export default function TermsPage() {
  return (
    <SiteShell honoreeName="Celebration Memories" navLinks={PLATFORM_NAV_LINKS} footerVariant="minimal">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Legal"
            title="Terms & Conditions"
            description="The terms that apply to using the platform and purchasing a plan."
            align="left"
          />
          <div className="mt-12 grid gap-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="font-display text-lg text-navy-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-navy-700/75">{section.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-xs text-navy-700/50">
            This is a general template and not a substitute for legal advice — {BUILDER.name} recommends having these
            terms reviewed by a qualified professional before relying on them for real transactions. Effective date:
            the date this page was last updated.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
