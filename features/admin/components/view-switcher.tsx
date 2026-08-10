import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

/**
 * A small segmented control letting a client flip between the two
 * alternative client-facing landing views — /admin/simple (a vertical
 * list of cards with setup progress/hints) and /admin/apps (a phone-
 * home-screen grid of app icons). Rendered in both pages' own slim
 * headers (SimpleHeader / AppsHeader) so switching is a single tap
 * either direction, instead of the one-way "Try the other view" link
 * that used to live only at the bottom of each page.
 */
export function ViewSwitcher({ active }: { active: "simple" | "apps" }) {
  return (
    <div className="flex items-center rounded-full border border-white/15 p-0.5 text-xs">
      <Link
        href="/admin/simple"
        title="List view — cards with setup progress and hints"
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-luxury duration-200 ${
          active === "simple" ? "bg-gold-500 text-navy-950" : "text-ivory-100/70 hover:text-gold-300"
        }`}
      >
        <List size={13} /> <span className="hidden sm:inline">List</span>
      </Link>
      <Link
        href="/admin/apps"
        title="App-icon view — a phone home-screen style grid"
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-luxury duration-200 ${
          active === "apps" ? "bg-gold-500 text-navy-950" : "text-ivory-100/70 hover:text-gold-300"
        }`}
      >
        <LayoutGrid size={13} /> <span className="hidden sm:inline">Icons</span>
      </Link>
    </div>
  );
}
