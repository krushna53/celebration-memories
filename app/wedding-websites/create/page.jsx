import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import UnderNav from "@/features/sacred-garden/under-nav";
import CreateInvitation from "./CreateInvitation";

export const metadata = {
  title: "Create your wedding website | EveryMoment",
  description: "Fill in your details on the left and see your wedding website take shape on the right.",
};

/** The Sacred Garden create page, under the site's own header. */
export default function CreateWeddingWebsitePage() {
  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <UnderNav>
        <CreateInvitation />
      </UnderNav>
    </SiteShell>
  );
}
