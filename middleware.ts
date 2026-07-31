import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Next.js's own NextRequest type dropped `geo` in v15, but Netlify
 * packages Middleware as an Edge Function and still populates it at
 * runtime with the visitor's country/region/city/lat/long — see
 * https://www.netlify.com/blog/next.js-middleware-on-netlify/. Read via
 * this narrow local type instead of `any`. Locally (`next dev`) or on
 * any host that doesn't inject it, `geo` is simply undefined.
 */
interface NetlifyGeoRequest {
  geo?: {
    country?: {
      code?: string;
    };
  };
}

const CURRENCY_HEADER = "x-detected-currency";

/**
 * Two unrelated jobs share this file because Next.js only runs one
 * middleware entry point per app:
 *
 * 1. /admin/* — refreshes the Supabase Auth session cookie on every
 *    request. Actual authorization (is this user an admin?) happens in
 *    app/admin/layout.tsx via the service-role client — this middleware's
 *    only job is keeping the session cookie alive, per the standard
 *    @supabase/ssr pattern.
 * 2. /pricing — detects the visitor's country from Netlify's injected
 *    geolocation and forwards it as a request header so the pricing
 *    page (a Server Component) can default to INR for India and USD
 *    everywhere else. See features/pricing/currency.ts for where this
 *    header is read.
 */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/pricing")) {
    const geo = (request as unknown as NetlifyGeoRequest).geo;
    const countryCode = geo?.country?.code ?? request.headers.get("x-country-code") ?? "";
    const currency = countryCode.toUpperCase() === "IN" ? "INR" : "USD";

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CURRENCY_HEADER, currency);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/pricing"],
};
