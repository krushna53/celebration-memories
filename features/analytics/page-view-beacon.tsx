"use client";

import { useEffect, useRef } from "react";

import { logPageViewAction } from "@/features/tracking/actions";
import type { PageViewType } from "@/services/tracking";

interface PageViewBeaconProps {
  eventId: string;
  page: PageViewType;
}

/**
 * Invisible — fires one Server Action call on mount to record a page
 * view, then never again for this mount. Deliberately client-side: the
 * homepage and /events/[slug] use ISR (`revalidate = 60`), so logging
 * from the page's server render would only fire once per revalidation
 * window, not once per real visitor. See services/tracking.ts.
 */
export function PageViewBeacon({ eventId, page }: PageViewBeaconProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    logPageViewAction(eventId, page).catch(() => {
      // Analytics failures should be invisible to the visitor.
    });
  }, [eventId, page]);

  return null;
}
