import type { Metadata } from "next";
import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { ContactForm } from "@/features/contact/contact-form";
import { BUILDER, SITE_NAME } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata: Metadata = {
  title: `Contact Us | ${SITE_NAME}`,
  description: "Questions about building your own event site, or anything else — send us a message and we'll reply by email.",
};

export default function ContactPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Get In Touch"
            title="Contact Us"
            description="Questions about building your own event site, or anything else — send a message and we'll reply by email."
          />
          <div className="mt-12">
            <Reveal>
              <ContactForm />
            </Reveal>
          </div>
          <p className="mt-8 text-center text-sm text-navy-700/60">
            Prefer WhatsApp? Message{" "}
            <a
              href={BUILDER.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-600 underline underline-offset-2"
            >
              {BUILDER.name}
            </a>{" "}
            directly.
          </p>

          <Reveal>
            <div className="mt-10 rounded-2xl border border-navy-950/10 bg-white p-6">
              <h2 className="font-display text-lg text-navy-950">Who You&rsquo;re Paying</h2>
              <p className="mt-2 text-sm leading-relaxed text-navy-700/75">
                {SITE_NAME} is built and operated by <strong className="text-navy-950">{BUILDER.name}</strong>. Any
                paid plan or purchase made on {SITE_NAME} is billed by {BUILDER.name} — this is the name that will
                appear on your card or bank statement, and the entity your payment processor (Razorpay, Stripe, or
                CCAvenue, depending on what&rsquo;s offered at checkout) settles funds to. For billing questions,
                receipts, or refund requests, use the form above or WhatsApp — see our{" "}
                <Link href="/refund-policy" className="text-gold-600 underline underline-offset-2">
                  Cancellation &amp; Refund Policy
                </Link>{" "}
                for how refunds work.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </SiteShell>
  );
}
