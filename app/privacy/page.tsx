import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { BUILDER } from "@/lib/constants";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What we collect",
    body: "When you open a personal invitation link: your name (pre-filled from the link), and whatever you choose to submit — RSVP details (contact info, guest count, meal preference, comments), photos/videos/audio you upload, and any guest book message. We also log basic visit metadata for the invitation link itself (open/visit counts, device and browser type, referral source) to help the host know who's seen their invitation — never used to identify guests beyond their own invitation token.",
  },
  {
    title: "Why we collect it",
    body: "Solely to run the event you're being invited to: to record your RSVP, to display the memories you choose to share on the event's Memory Wall, and to let the host plan logistics (headcount, dietary needs). Nothing here is used for advertising, sold to third parties, or used to build a profile of you across other sites.",
  },
  {
    title: "Where it's stored",
    body: "In a Supabase (PostgreSQL + object storage) project operated for this event. Access is restricted to the event's admin account(s) via authentication — there is no public listing of guest personal details anywhere on the site.",
  },
  {
    title: "Your choices",
    body: "Providing phone/email on the RSVP form is optional. Uploads and guest book entries are entirely optional and go through host moderation before appearing publicly — nothing you submit is shown on the site automatically. You can ask the host to review, correct, or delete any information you've submitted at any time.",
  },
  {
    title: "How long we keep it",
    body: "For as long as the event site remains active, plus a reasonable period afterward for the host to preserve memories, unless you ask for earlier deletion.",
  },
  {
    title: "Requesting a copy or deletion of your data",
    body: "Contact the event host directly (the link that brought you here) or reach the platform operator via WhatsApp — see the link in the footer — and reference the event name and your invitation link.",
  },
];

export default function PrivacyPage() {
  return (
    <SiteShell honoreeName="Celebration Memories" navLinks={PLATFORM_NAV_LINKS} footerVariant="minimal">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Your Data"
            title="Privacy Notice"
            description="What we collect when you use an invitation link, and why."
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
            This site is built and operated by {BUILDER.name} on behalf of the
            event host. Questions about this notice can be sent via the
            WhatsApp link in the footer.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
