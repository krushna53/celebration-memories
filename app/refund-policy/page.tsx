import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUILDER } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata = {
  title: "Cancellation & Refund Policy — EveryMoment",
  description: "How to cancel a plan and what's refundable on EveryMoment.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Free plan",
    body: "The Free plan costs nothing, so there's nothing to cancel or refund. You can stop using it or delete your event at any time.",
  },
  {
    title: "Cancelling a paid plan",
    body: "You can cancel a monthly or annual subscription at any time from your account, or by contacting us via the Contact Us page. Cancelling stops future billing; it does not automatically delete your event site or its content.",
  },
  {
    title: "Refund eligibility",
    body: "If you're on a paid plan and haven't meaningfully used it (e.g., published a live site, sent invitations, or accepted guest RSVPs/uploads), you can request a full refund within 7 days of the charge. After a site has gone live and been shared with guests, or once a one-time payment has been used to publish a site for an event, we generally can't offer a refund, since the service — hosting a working, shareable site — has already been delivered. We'll still review requests made in good faith on a case-by-case basis, for example a genuine billing error or duplicate charge.",
  },
  {
    title: "Promo codes and free access",
    body: "Access granted through a promo code (e.g., a launch offer) was not paid for, so there's nothing to refund if that code is later withdrawn or expires.",
  },
  {
    title: "How to request a refund",
    body: "Contact us via the Contact Us page or the WhatsApp link in the footer with your registered email and the event name. Include the payment reference or receipt if you have it — this speeds things up.",
  },
  {
    title: "Processing time",
    body: "Approved refunds are processed back to the original payment method within 5–7 business days, though your bank or card network may take a few additional days to reflect it on your statement.",
  },
  {
    title: "Failed or duplicate payments",
    body: "If a payment is deducted but the plan doesn't activate, or you're charged more than once for the same plan due to a technical error, contact us right away — this is refunded in full once verified, regardless of the eligibility window above.",
  },
];

export default function RefundPolicyPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} footerVariant="minimal">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Legal"
            title="Cancellation & Refund Policy"
            description="How to cancel a plan, and what's refundable."
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
            This is a general template and not a substitute for legal advice — {BUILDER.name} recommends having this
            policy reviewed by a qualified professional before relying on it for real transactions.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
