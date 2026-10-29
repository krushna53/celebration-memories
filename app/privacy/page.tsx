import type { Metadata } from "next";
import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUILDER, SITE_NAME } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `How ${SITE_NAME} collects, uses, and stores information from event hosts and guests.`,
};

const SECTIONS: { title: string; body: string }[] = [
  { title: "Who handles your data", body: `${SITE_NAME} is operated by ${BUILDER.name}. The event host determines how their guest list, invitations, RSVP answers and event memories are used. The platform handles account, security, support and billing information and processes event information to provide the service. Contact us using the privacy request link below; you do not need an account to make a request.` },
  { title: "Information and purposes", body: "For accounts we use your name, email, authentication and host/business details to provide access and support. For invitations and RSVP we use the guest name, optional contact information, attendance, party size, meal preferences and custom answers to deliver invitations and plan the event. Messages, photos, video, audio and their metadata are used for the memories or publishing feature you choose. Invitation opens, device/browser information and referral attribution help hosts understand invitation delivery. Security and login records help prevent abuse. Inquiries and billing records support replies, purchases and accounting. Provide only information needed for the event; avoid sensitive information in free-text fields." },
  { title: "Who can see it", body: "Hosts and authorised event team members can access guest information. Published event pages, approved memories, shared collections and externally shared links can be visible to their audience, including the public when the event is public. A private directory listing does not itself restrict access by link. The host controls viewing and publication settings. Downloaded or independently shared copies cannot be recalled by changing a site setting." },
  { title: "Service providers and international processing", body: "The service uses Supabase for authentication, database and managed storage. Enabled features may send necessary information to email, payment, AI image/video, rendering, push notification and Google Photos providers. External embeds and links have their own privacy practices. Provider infrastructure may process information outside India; do not assume Indian-only storage. Ask us for the providers and locations applicable to your event. We do not sell your personal data." },
  { title: "Optional analytics and recordings", body: "Google Analytics loads only if you choose Allow analytics. Declining does not prevent use of the site. Use Privacy choices to withdraw consent; this stops future analytics on this browser and clears accessible first-party Google Analytics cookies. It does not erase information already received by Google. The choice is specific to this browser. Microsoft Clarity session recording is disabled. Essential authentication, security and referral functionality operates separately from optional analytics." },
  { title: "Optional selfies, face matching and AI", body: "Guest Reels uses a separately opted-in reference photo for face matching in the host’s browser and reel creation. It is optional; removing your reference photo withdraws that feature’s consent. Contact us to request removal of existing matches, rendered reels or shared outputs as well. AI and external rendering features may send selected content to their providers: use them only with permission from the people concerned. An organiser’s upload is not a substitute for any legally required parental consent." },
  { title: "Children and other people’s information", body: "A child under Indian DPDP law is a person under 18. Children should not create accounts or submit personal information themselves. A parent or lawful guardian should contact the host or platform before a child’s personal data or images are collected. Do not upload another person’s information without authority. This site does not yet provide a verified parental-consent workflow; hosts must not use it to collect children’s personal data until the required verification and safeguards are in place." },
  { title: "Withdrawal, access, correction and erasure", body: "You can request a summary of your personal data and processing, information about sharing, correction or completion, erasure, withdrawal of consent, or nomination of another individual to exercise applicable rights upon death or incapacity. Send the event name, the request type and a contact address through the privacy request link below or contact the host. Do not send passwords, invitation tokens, identity documents or payment details in an initial request. We may verify your identity and authority using proportionate information before releasing or changing data. Withdrawal does not affect earlier lawful processing; a feature may stop working where its necessary data is withdrawn. Account holders can also use Admin → Delete Account." },
  { title: "Retention and deletion", body: "Event information is currently retained while the event service is maintained or until an applicable deletion request is fulfilled. Automated event-expiry deletion is not yet implemented. Ask the host or platform to remove information that is no longer needed. Some security, transaction or legal records may need to be retained under applicable law; we will explain relevant exceptions when responding. Removal must also cover managed storage and processors where applicable. Backup expiry and independently downloaded copies may delay or limit complete removal." },
  { title: "Grievances and language assistance", body: `Address privacy grievances to ${BUILDER.name} using the direct link below or the Contact page. Please identify the event, concern and desired remedy. You can use the same channel to follow up or request this notice and assistance in an Indian language. Requests can be submitted through our privacy request form and are reviewed manually. Save your reference to follow up. Applicable grievance timelines and escalation to the Data Protection Board of India depend on the provisions in force; use the grievance channel first and retain your correspondence.` },
];

export default function PrivacyPage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} footerVariant="minimal">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Your Data"
            title="Privacy Notice"
            description="Accounts, invitations, event memories and your privacy choices. Updated 30 October 2026."
            align="left"
          />
          <div className="mt-8 rounded-xl border border-navy-950/10 bg-white p-5 text-sm text-navy-950">
            <Link href="/privacy/requests" className="mb-3 block font-medium underline">Submit a privacy request online</Link>
            <a href="https://wa.me/919987982969?text=Privacy%20request%20for%20EveryMoment" target="_blank" rel="noopener noreferrer" className="font-medium underline">Make a privacy request or raise a grievance</a>
            <p className="mt-2">WhatsApp: +91 99879 82969, {BUILDER.name}. You can also use <Link href="/contact" className="underline">our contact form</Link>. Include the event name and request type.</p>
          </div>
          <div className="mt-12 grid gap-8">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="font-display text-lg text-navy-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-navy-700/75">{section.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-xs text-navy-700/50">
            This site is built and operated by {BUILDER.name} on behalf of the
            event host. Questions about this notice can be sent via the
            WhatsApp link in the footer.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
