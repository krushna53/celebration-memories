"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { ACTIVE_EVENT, NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Sticky, translucent site navigation. Collapses into a slide-down sheet
 * on mobile. Purely presentational — all anchors point at in-page
 * sections that later phases will populate.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-luxury duration-500",
        scrolled
          ? "bg-navy-950/80 backdrop-blur-md shadow-[0_1px_0_0_rgba(201,162,39,0.25)]"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-ivory-50">
        <a
          href="#hero"
          className="font-display text-lg tracking-wide text-gold-300"
        >
          {ACTIVE_EVENT.honoreeName}
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm tracking-wide text-ivory-100/85 transition-luxury duration-300 hover:text-gold-300"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="text-ivory-50 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <div
        className={cn(
          "overflow-hidden transition-luxury duration-500 md:hidden",
          open ? "max-h-96" : "max-h-0",
        )}
      >
        <ul className="flex flex-col gap-1 bg-navy-950/95 px-6 pb-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-3 text-sm text-ivory-100/85 hover:text-gold-300"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
