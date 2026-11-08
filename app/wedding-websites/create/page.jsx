import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import UnderNav from "@/features/sacred-garden/under-nav";
import { wizardStepHref } from "@/features/start/wizard-steps";
import { getDraftEventByToken } from "@/services/event-drafts";
import { RsvpTeaserSection } from "@/features/rsvp/rsvp-teaser-section";
import CreateInvitation from "./CreateInvitation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create your wedding website | EveryMoment",
  description: "Fill in your details on the left and see your wedding website take shape on the right.",
};

/**
 * The Sacred Garden create page, under the site's own header. Publish starts a wedding
 * draft and carries on in the wizard; a wizard link (`?draft=<token>`) opens its Design step instead.
 */
export default async function CreateWeddingWebsitePage({ searchParams }) {
  const { draft } = await searchParams;
  if (typeof draft === "string" && draft && (await getDraftEventByToken(draft))) redirect(wizardStepHref(draft, "design"));
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <UnderNav>
        <CreateInvitation rsvp={<RsvpTeaserSection category="wedding" />} />
      </UnderNav>
    </SiteShell>
  );
}
