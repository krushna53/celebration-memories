"use client";

import { useEffect, useRef } from "react";

import { buildMapsEmbedUrl, buildMapsSearchUrl, buildVenueQuery, isAutoMapsEmbedUrl, isAutoMapsUrl } from "@/lib/maps";

/**
 * Keeps the Google Maps directions + embed links in step with the Venue
 * Name and Venue Address fields as the host types — no "Generate" click
 * needed. Waits until typing pauses (so the map preview doesn't reload on
 * every keystroke), needs an address, and only replaces links that are
 * empty or were auto-generated: a link pasted by hand is left alone.
 * Nothing changes on page load — only after the name/address are edited.
 */
export function useAutoVenueMaps(params: {
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  mapsEmbedUrl: string;
  onChange: (patch: { mapsUrl?: string; mapsEmbedUrl?: string }) => void;
}) {
  const { venueName, venueAddress } = params;
  const latest = useRef(params);
  latest.current = params;
  const initial = useRef({ venueName, venueAddress });

  useEffect(() => {
    if (venueName === initial.current.venueName && venueAddress === initial.current.venueAddress) return;
    if (!venueAddress.trim()) return;
    const timer = window.setTimeout(() => {
      const { mapsUrl, mapsEmbedUrl, onChange } = latest.current;
      const query = buildVenueQuery(venueName, venueAddress);
      const patch: { mapsUrl?: string; mapsEmbedUrl?: string } = {};
      const nextUrl = buildMapsSearchUrl(query);
      const nextEmbed = buildMapsEmbedUrl(query);
      if (isAutoMapsUrl(mapsUrl) && mapsUrl !== nextUrl) patch.mapsUrl = nextUrl;
      if (isAutoMapsEmbedUrl(mapsEmbedUrl) && mapsEmbedUrl !== nextEmbed) patch.mapsEmbedUrl = nextEmbed;
      if (patch.mapsUrl || patch.mapsEmbedUrl) onChange(patch);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [venueName, venueAddress]);
}
