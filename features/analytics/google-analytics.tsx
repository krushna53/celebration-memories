"use client";

import Script from "next/script";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/** Manually tracks navigation without sending invitation tokens or query strings. */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const pathname = usePathname();
  const params = useParams();
  const configured = useRef(false);
  const previousLocation = useRef<string | null>(null);
  const validId = measurementId && /^G-[A-Z0-9]+$/.test(measurementId);

  // Replace every dynamic route value (tokens, event slugs, IDs) with its
  // parameter name. Never include search parameters, fragments, or page titles.
  let pagePath = pathname ?? "/";
  for (const [name, value] of Object.entries(params ?? {})) {
    for (const segment of Array.isArray(value) ? value : [value]) {
      if (segment) {
        pagePath = pagePath.split("/").map((part) =>
          part === segment || part === encodeURIComponent(segment) ? `[${name}]` : part
        ).join("/");
      }
    }
  }

  useEffect(() => {
    if (!validId) return;
    const analytics = window as AnalyticsWindow;
    analytics.dataLayer = analytics.dataLayer || [];
    analytics.gtag = analytics.gtag || function () {
      // Google's queue expects the original arguments object.
      // eslint-disable-next-line prefer-rest-params
      analytics.dataLayer!.push(arguments);
    };
    const location = `${window.location.origin}${pagePath}`;
    if (!configured.current) {
      analytics.gtag("js", new Date());
      analytics.gtag("config", measurementId, {
        send_page_view: false,
        page_location: location,
        page_referrer: "",
        page_title: pagePath,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      configured.current = true;
    }
    if (previousLocation.current === location) return;
    analytics.gtag("set", {
      page_location: location,
      page_title: pagePath,
      page_referrer: previousLocation.current ?? "",
    });
    analytics.gtag("event", "page_view", { send_to: measurementId });
    previousLocation.current = location;
  }, [measurementId, validId, pagePath]);

  if (!validId) return null;
  return (
    <Script
      id="google-analytics"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  );
}
