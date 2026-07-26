import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

interface SiteShellProps {
  children: React.ReactNode;
  honoreeName?: string;
  /** Set only by templates/CommunityTemplate — shows a "Template design by {name}" credit line in the footer, per the community template submission system's due-credit requirement. */
  designerCredit?: { name: string; website?: string | null };
}

/**
 * Public-site chrome (fixed nav + footer) — used by marketing/guest
 * pages only. Deliberately NOT rendered from the root layout, so admin
 * routes (which have their own header) don't end up with the public
 * fixed navbar overlapping them.
 */
export function SiteShell({ children, honoreeName, designerCredit }: SiteShellProps) {
  return (
    <>
      <Navbar honoreeName={honoreeName} />
      <main>{children}</main>
      <Footer designerCredit={designerCredit} />
    </>
  );
}
