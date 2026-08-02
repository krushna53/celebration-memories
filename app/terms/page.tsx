import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUILDER, SITE_NAME } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata = {
  title: `Terms & Conditions — ${"EveryMoment"}`,
  description: "The terms that apply to using EveryMoment and purchasing a plan.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Who this applies to",
    body: `These terms apply to anyone who creates an event site, lists a business, or otherwise registers an account on ${SITE_NAME} ("the platform," "we," "us"), whether on the Free plan or a paid Premium/Pro plan (see /pricing for current plan details). ${SITE_NAME} is built and operated by ${BUILDER.name}.`,
  },
  {
    title: "Eligibility",
    body: "You must be at least 18, or the age of legal majority where you live, and able to enter a binding contract, to create an account. If you're registering on behalf of a company or other organization, you're confirming you have the authority to bind that organization to these terms.",
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
    title: "Our intellectual property",
    body: `The platform's software, source code, system architecture, database design, admin dashboard, templates, visual designs, workflows, and underlying business methods (together, "Platform IP") are the exclusive property of ${BUILDER.name} and are protected by copyright, trade secret, and other applicable laws. Creating an account, publishing an event site, or listing a business on the platform gives you a limited, personal right to use the hosted service as intended — it does not transfer, license, or grant any ownership interest in the Platform IP, and does not give you any right to the underlying code, design files, database structure, or business methods themselves, even the parts you can see through your own dashboard.`,
  },
  {
    title: "Trademarks",
    body: `"${SITE_NAME}," our logo, and other branding shown on the platform belong to ${BUILDER.name}. You may refer to the platform by name in a factual, non-misleading way (for example, "built with ${SITE_NAME}"), but you may not use our name, logo, or branding in a domain name, business name, app, or marketing material, or in any way that suggests your product is made or endorsed by us, without our prior written permission.`,
  },
  {
    title: "Confidentiality",
    body: `Using the service — including the admin dashboard, analytics, pricing structure, or any other non-public information you're able to see — may expose you to information about how the platform is built and operated that isn't publicly available ("Confidential Information"). You agree to keep Confidential Information confidential, to use it only to operate your own event site or business listing, and not to disclose it to anyone else without our prior written consent. This obligation continues even after you stop using the service, for as long as the information stays non-public.`,
  },
  {
    title: "No copying, reverse engineering, or competing use",
    body: "You agree not to copy, scrape, decompile, reverse-engineer, or otherwise attempt to extract the source code, design, templates, database structure, prompts/configuration, or underlying business methods of the platform; not to use Confidential Information, or any access gained through the service, to build, operate, fund, or materially assist a product or service that competes with the platform; and not to help, authorize, or knowingly enable anyone else to do either of those things. This is about the platform's own systems and methods, not about the event, business, or brand you run using it — nothing here stops you from operating your own unrelated business.",
  },
  {
    title: "No solicitation",
    body: "For 12 months after your account is closed, you agree not to use Confidential Information to knowingly solicit, for a competing purpose, any other client, vendor, or team member you became aware of through the platform.",
  },
  {
    title: "Enforcement",
    body: "Breaching the intellectual property, confidentiality, or non-circumvention terms above can cause harm that money alone may not fully repair, so in addition to damages we may seek an injunction or other equitable relief without having to prove that damages would be inadequate first. We may also suspend or terminate an account immediately for a breach of this kind, without a refund, and without it limiting any other remedy available to us.",
  },
  {
    title: "Service availability",
    body: "We aim for reliable uptime but don't guarantee the service will be uninterrupted or error-free, and we're not liable for losses arising from downtime, third-party service outages (hosting, storage, payment, or AI providers we depend on), or content lost due to circumstances outside our reasonable control. Keep your own copies of anything irreplaceable.",
  },
  {
    title: "Limitation of liability",
    body: "To the fullest extent the law allows, our total liability arising from these terms or your use of the platform is capped at the amount you paid us in the 12 months before the claim arose (or, if you're on the Free plan, at ₹5,000). We're not liable for indirect, incidental, or consequential losses — lost profits, lost data, or reputational harm — even if we'd been told they were possible. This cap doesn't apply to liability that can't be limited by law, such as for fraud, or for death or personal injury caused by negligence.",
  },
  {
    title: "Indemnification",
    body: "You agree to cover our reasonable costs (including legal fees) and any resulting loss if a third party makes a claim against us because of content you uploaded, your use of the platform in violation of these terms, or your violation of someone else's rights.",
  },
  {
    title: "Cancellation and refunds",
    body: "See our separate Cancellation & Refund Policy for how to cancel a plan and what's refundable.",
  },
  {
    title: "Governing law and disputes",
    body: "These terms are governed by the laws of India. We'll try to resolve any dispute informally first; failing that, it's subject to the exclusive jurisdiction of the courts of India, or arbitration under the Arbitration and Conciliation Act, 1996, at our election.",
  },
  {
    title: "Severability, assignment, and entire agreement",
    body: "If any part of these terms turns out to be unenforceable, the rest stays in effect. We may assign these terms — for example, if the business is sold, merged, or reorganized; you may not assign your account or these terms to anyone else without our written consent. Together with our Privacy Policy and Cancellation & Refund Policy, these terms are the whole agreement between us about the platform and replace any earlier discussion or agreement on the same subject.",
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
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} footerVariant="minimal">
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
            terms reviewed by a qualified professional before relying on them for real transactions. In particular,
            broad restrictions on competing after someone has stopped using the service aren&rsquo;t enforceable in
            every jurisdiction — Indian contract law, for example, restricts many non-compete clauses under Section
            27 of the Indian Contract Act, 1872. The confidentiality and non-circumvention terms above are written to
            focus on protecting confidential information specifically, since that framing holds up far better than a
            blanket &ldquo;you may never build anything similar&rdquo; clause, but a lawyer should confirm this for
            your situation — especially before onboarding a client or vendor who&rsquo;ll see enough of the backend
            or business model that a separately signed NDA would be worth having in addition to this click-through
            agreement. Effective date: the date this page was last updated.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
