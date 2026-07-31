import "server-only";
import { headers } from "next/headers";

export type Currency = "USD" | "INR";

/**
 * Reads the country-based currency guess that middleware.ts attaches to
 * every /pricing request (from Netlify's injected geolocation). Always
 * resolves to a currency — defaults to USD if the header is missing,
 * e.g. in local dev where no geolocation is injected.
 */
export async function getDetectedCurrency(): Promise<Currency> {
  const headerList = await headers();
  return headerList.get("x-detected-currency") === "INR" ? "INR" : "USD";
}
