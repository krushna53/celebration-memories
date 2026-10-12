"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print dialog — "Save as PDF" there gives the host a file to send. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-navy-950 px-5 py-2.5 text-sm font-medium text-gold-300 transition-luxury duration-300 hover:brightness-125"
    >
      <Printer size={16} /> Print / Save as PDF
    </button>
  );
}
