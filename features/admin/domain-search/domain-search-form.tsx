"use client";

import { useState } from "react";
import { ExternalLink, Globe, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { searchDomainsAction } from "@/features/admin/domain-search/actions";
import type { DomainAvailabilityResult } from "@/types/domain-search";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

/** GoDaddy's own no-API-key-required checkout search page — a client-safe duplicate of lib/godaddy.ts's version, since that file is server-only. */
function godaddySearchUrl(domain: string): string {
  return `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(domain)}`;
}

interface DomainSearchFormProps {
  configured: boolean;
  defaultQuery?: string;
}

export function DomainSearchForm({ configured, defaultQuery = "" }: DomainSearchFormProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DomainAvailabilityResult[] | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    const outcome = await searchDomainsAction(query);
    setBusy(false);
    if (outcome.success) {
      setResults(outcome.results);
    } else {
      setError(outcome.error);
      setResults(null);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-dashed border-navy-950/15 bg-white p-8 text-center">
        <Globe className="mx-auto text-navy-700/30" size={28} />
        <h3 className="mt-3 font-display text-lg text-navy-950">Domain search isn&rsquo;t set up yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-navy-700/60">
          Add <code className="rounded bg-navy-950/5 px-1.5 py-0.5">GODADDY_API_KEY</code> and{" "}
          <code className="rounded bg-navy-950/5 px-1.5 py-0.5">GODADDY_API_SECRET</code> to your
          environment to enable live availability + pricing — get a free key at{" "}
          <a
            href="https://developer.godaddy.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-600 underline underline-offset-2"
          >
            developer.godaddy.com/keys
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className={inputClasses}
          placeholder="e.g. maheshbday, smithwedding75"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={busy || !query.trim()} className="shrink-0">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          Search
        </Button>
      </div>
      <p className="-mt-3 text-xs text-navy-700/50">
        We&rsquo;ll check availability across common TLDs (.com, .in, .co, .events, and more).
        Purchase happens on GoDaddy&rsquo;s own site — we don&rsquo;t process payment here.
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {results ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <div
              key={r.domain}
              className="flex items-center justify-between gap-3 rounded-xl border border-navy-950/10 bg-white px-4 py-3"
            >
              <div>
                <p className="font-medium text-navy-950">{r.domain}</p>
                {r.available ? (
                  <p className="text-xs text-green-700">
                    Available
                    {r.price !== null ? ` · ${r.currency ?? "USD"} ${r.price.toFixed(2)}/yr` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-navy-700/45">Taken</p>
                )}
              </div>
              {r.available ? (
                <Button asChild variant="outline" size="sm">
                  <a href={godaddySearchUrl(r.domain)} target="_blank" rel="noopener noreferrer">
                    Buy on GoDaddy <ExternalLink size={12} />
                  </a>
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
