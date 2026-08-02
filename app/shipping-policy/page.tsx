import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUILDER } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata = {
  title: "Shipping & Delivery Policy — EveryMoment",
  description: "EveryMoment is a digital service — how and when it's delivered.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "No physical shipping",
    body: "EveryMoment is a fully digital service — an event website, RSVP system, and memory-sharing tool. Nothing is physically shipped, so there are no shipping charges, carriers, or delivery addresses involved.",
  },
  {
    title: "How the service is delivered",
    body: "Access is delivered instantly online. A Free-plan site is available as soon as you finish building it in the wizard. A paid plan's full features (custom domain request, branding removal, higher upload limits, and so on) activate immediately once payment is confirmed — usually within a few seconds for card/UPI checkout, or within a few hours for a manually confirmed UPI/bank transfer submitted via the QR payment option.",
  },
  {
    title: "Delays",
    body: "In the rare case a manually confirmed payment takes longer to verify (for example, outside business hours), we'll activate the plan as soon as it's confirmed and notify you. If a plan hasn't activated within 24 hours of payment, please contact us.",
  },
];

export default function ShippingPolicyPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} footerVariant="minimal">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Legal"
            title="Shipping & Delivery Policy"
            description="EveryMoment is a digital service — here's how and when it's delivered."
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
            Questions about delivery or activation can be sent via the Contact Us page or the WhatsApp link in the
            footer — {BUILDER.name} typically responds within one business day.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
