import Link from "next/link";

const TABS = [
  { id: "webpages", label: "Websites", href: "/wedding/webpages" },
  { id: "reels", label: "Reels", href: "/wedding/reels" },
  { id: "card", label: "Cards", href: "/wedding/card" },
] as const;

export type WeddingTab = (typeof TABS)[number]["id"];

/** Switches between the three wedding galleries: websites, reels and cards. */
export function WeddingTabs({ active }: { active: WeddingTab }) {
  return (
    <nav aria-label="Wedding designs" className="mx-auto mt-8 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-navy-950/10 bg-white p-1 shadow-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition ${
            tab.id === active ? "bg-navy-950 text-ivory-50" : "text-navy-700 hover:bg-ivory-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
