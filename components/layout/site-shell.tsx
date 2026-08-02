import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SupportChatWidget } from "@/features/support/support-chat-widget";

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
  /**
   * Passed straight through to Navbar — only set this when `children`
   * itself opens with a dark, full-bleed section directly under the nav
   * (the event homepage templates' shared HeroSection, or the platform
   * homepage's own dark intro section). Leave it off (the default) for
   * every lighter-background page — see Navbar's doc comment for why
   * getting this wrong makes the nav links unreadable.
   */
  transparentUntilScroll?: boolean;
  /** Passed straight through to Footer — see its doc comment for "full" vs "minimal". Defaults to "full". */
  footerVariant?: "full" | "minimal";
  /** Hides the floating support chat bubble — off for the public "share a memory" page, which is a focused single task (upload a photo/video/audio) for guests who may not be comfortable with phones; a floating chat bubble is one more thing to misread as part of the upload flow. Defaults to false (shown), which is every other public page. */
  hideChatWidget?: boolean;
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
  transparentUntilScroll,
  footerVariant,
  hideChatWidget,
}: SiteShellProps) {
  return (
    <>
      <Navbar
        honoreeName={honoreeName}
        navLinks={navLinks}
        showLogin={showLogin}
        transparentUntilScroll={transparentUntilScroll}
      />
      <main>{children}</main>
      <Footer designerCredit={designerCredit} variant={footerVariant} />
      {hideChatWidget ? null : <SupportChatWidget />}
    </>
  );
}
