"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Loader2, Upload } from "lucide-react";

import { bulkImportListingsAction } from "@/features/admin/marketplace/actions";
import type { MarketplaceCategory, MarketplaceCity } from "@/types/marketplace";

export function CsvImport({ categories, cities }: { categories: MarketplaceCategory[]; cities: MarketplaceCity[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    setSummary(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        const rows = data.map((row) => ({
          displayName: row.displayName ?? row.name ?? row.Name ?? "",
          categorySlug: row.categorySlug ?? row.category ?? "",
          citySlug: row.citySlug ?? row.city ?? "",
          description: row.description ?? "",
          contactEmail: row.contactEmail ?? row.email ?? "",
          contactPhone: row.contactPhone ?? row.phone ?? "",
        }));
        setBusy(true);
        const result = await bulkImportListingsAction(rows);
        setBusy(false);
        if (result.success) {
          setSummary(`Imported ${result.data.created} listing(s) (${result.data.skipped} skipped). They're approved and live immediately.`);
        } else {
          setError(result.error);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  }

  return (
    <div className="rounded-2xl border border-navy-950/10 bg-white p-5">
      <p className="font-display text-lg text-navy-950">Bulk Import Listings</p>
      <p className="mt-1 text-sm text-navy-700/60">
        Import listings from a CSV. Imported listings are attached to a shared &ldquo;Admin Bulk Import&rdquo; vendor
        account and published immediately — use the Listings tab afterward to edit, feature, or unpublish any of them.
      </p>

      <p className="mt-3 text-xs text-navy-700/50">
        Columns: <code className="rounded bg-navy-950/5 px-1 py-0.5">displayName, categorySlug, citySlug, description, contactEmail, contactPhone</code>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-navy-700/50">
        <span>Valid category slugs:</span>
        {categories.map((c) => (
          <code key={c.id} className="rounded bg-navy-950/5 px-1 py-0.5">
            {c.slug}
          </code>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-navy-700/50">
        <span>Valid city slugs:</span>
        {cities.map((c) => (
          <code key={c.id} className="rounded bg-navy-950/5 px-1 py-0.5">
            {c.slug}
          </code>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="mt-4 flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import CSV
      </button>

      {summary ? <p className="mt-3 text-sm text-emerald-700">{summary}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
