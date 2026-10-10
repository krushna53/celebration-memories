"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import type { DashboardLink } from "@/lib/dashboard-links";
import { ADMIN_NAV } from "@/lib/admin-nav";

const shortcutIcons = new Map(ADMIN_NAV.map(({ href, icon }) => [href, icon]));

export function DashboardMenu({ path, items, mobile, onNavigate }: {
  path: string; items: DashboardLink[]; mobile: boolean; onNavigate?: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  function close() {
    if (ref.current) ref.current.open = false;
    onNavigate?.();
  }
  return (
    <details ref={ref} className={mobile ? "relative w-full" : "relative"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && ref.current) ref.current.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gold-400/40 px-4 py-2 text-sm text-gold-300 [&::-webkit-details-marker]:hidden">
        <LayoutDashboard size={16} aria-hidden="true" /> Dashboard <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <nav aria-label="Dashboard shortcuts" className={`${mobile ? "mt-2 w-full" : "absolute right-0 top-full mt-2 w-72"} z-[70] max-h-[min(65vh,32rem)] overflow-y-auto rounded-xl border border-gold-500/20 bg-navy-950 p-2 shadow-xl`}>
        <Link href={path} onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-gold-300 hover:bg-white/10 focus:bg-white/10"><LayoutDashboard size={18} className="shrink-0" aria-hidden="true" /><span>Go to Dashboard</span></Link>
        {items.map((item) => {
          const Icon = shortcutIcons.get(item.href) ?? LayoutDashboard;
          return <Link key={item.href} href={item.href} onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ivory-100 hover:bg-white/10 focus:bg-white/10"><Icon size={18} className="shrink-0 text-gold-300" aria-hidden="true" /><span className="min-w-0">{item.label}</span></Link>;
        })}
      </nav>
    </details>
  );
}
