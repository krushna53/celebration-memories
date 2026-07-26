import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { ContactForm } from "@/features/contact/contact-form";
import { BUILDER } from "@/lib/constants";

export default function ContactPage() {
  return (
    <SiteShell honoreeName="Celebration Memories">
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
        </div>
      </div>
    </SiteShell>
  );
}
