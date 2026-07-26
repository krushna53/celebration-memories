import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

interface NavLink {
  label: string;
  href: string;
}

interface SiteShellProps {
  children: React.ReactNode;
  honoreeName?: string;
  /** Set only by templates/CommunityTemplate — shows a "Template design by {name}" credit line in the footer, per the community template submission system's due-credit requirement. */
  designerCredit?: { name: string; website?: string | null };
  /** Overrides the default in-page anchor nav — see components/layout/navbar.tsx. */
  navLinks?: readonly NavLink[];
  /** Shows a "Login" link in the nav — set on the platform homepage, off on event pages. */
  showLogin?: boolean;
}

/**
 * Public-site chrome (fixed nav + footer) — used by marketing/guest
 * pages only. Deliberately NOT rendered from the root layout, so admin
 * routes (which have their own header) don't end up with the public
 * fixed navbar overlapping them.
 */
export function SiteShell({
  children,
  honoreeName,
  designerCredit,
  navLinks,
  showLogin,
}: SiteShellProps) {
  return (
    <>
      <Navbar honoreeName={honoreeName} navLinks={navLinks} showLogin={showLogin} />
      <main>{children}</main>
      <Footer designerCredit={designerCredit} />
    </>
  );
}
