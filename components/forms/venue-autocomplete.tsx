"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { searchPlaces, timezoneForPlace, type PlaceSuggestion } from "@/lib/place-search";

const DEBOUNCE_MS = 350;

/**
 * "Search for your venue" box shared by Event Settings and the wizard's
 * Event Details step. Picking a suggestion hands the caller the place
 * plus its timezone (looked up offline from the coordinates) — the
 * caller decides which form fields to fill. Free / key-free, see
 * lib/place-search.ts. Implements the ARIA combobox pattern: arrow keys
 * move through suggestions, Enter picks, Escape closes.
 */
export function VenueAutocomplete({
  onSelect,
  inputClassName,
  placeholder = "Start typing the venue name or address…",
}: {
  onSelect: (place: PlaceSuggestion, timezone: string | null) => void;
  inputClassName?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then((places) => {
          setResults(places);
          setActive(-1);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setResults([]);
          setError("Couldn't search places right now — type the address manually below.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function pick(place: PlaceSuggestion) {
    setOpen(false);
    setQuery(place.name);
    setResults([]);
    onSelect(place, await timezoneForPlace(place));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      // Keep Enter from submitting the surrounding form while choosing.
      e.preventDefault();
      const place = results[active];
      if (place) void pick(place);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length >= 3 && (results.length > 0 || !loading);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-700/40" size={15} />
        <input
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Search for your venue"
          autoComplete="off"
          className={cn(inputClassName, "pl-9 pr-9")}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-navy-700/40" size={15} />
        ) : null}
      </div>

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-navy-950/10 bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-navy-700/60">No places found — try adding the city.</li>
          ) : (
            results.map((place, i) => (
              <li
                key={place.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(place)}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 px-3 py-2.5",
                  i === active ? "bg-gold-500/10" : "hover:bg-navy-950/[0.03]",
                )}
              >
                <MapPin className="mt-0.5 shrink-0 text-gold-600" size={15} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-navy-950">{place.name}</span>
                  {place.address ? <span className="block truncate text-xs text-navy-700/60">{place.address}</span> : null}
                </span>
              </li>
            ))
          )}
          <li className="border-t border-navy-950/5 px-3 pt-1.5 text-[10px] text-navy-700/40" aria-hidden>
            Search by Photon · © OpenStreetMap contributors
          </li>
        </ul>
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
