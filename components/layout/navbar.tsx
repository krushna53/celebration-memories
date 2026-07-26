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
interface NavbarProps {
  honoreeName?: string;
}

export function Navbar({ honoreeName = ACTIVE_EVENT.honoreeName }: NavbarProps) {
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
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 text-ivory-50 sm:px-6 sm:py-4">
        <a
          href="#hero"
          className="truncate font-display text-base tracking-wide text-gold-300 sm:text-lg"
        >
          {honoreeName}
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
          className="tap-target -mr-2 flex shrink-0 items-center justify-center text-ivory-50 md:hidden"
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
        <ul className="flex flex-col gap-1 bg-navy-950/95 px-4 pb-4 sm:px-6 sm:pb-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="tap-target flex items-center text-sm text-ivory-100/85 hover:text-gold-300"
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
