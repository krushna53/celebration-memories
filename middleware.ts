import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { REF_COOKIE } from "@/lib/constants";

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

const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — comfortably longer than a typical evaluate-then-sign-up window

function sanitizeRefCode(raw: string | null): string | null {
  if (!raw) return null;
  return /^[a-zA-Z0-9_-]{1,32}$/.test(raw) ? raw : null;
}

/** Stamps the referral cookie onto a response if this request carried a valid `?ref=` — never overwrites with garbage, and only ever (re)sets when the param is actually present. */
function withRefCookie(response: NextResponse, refCode: string | null): NextResponse {
  if (refCode) {
    response.cookies.set(REF_COOKIE, refCode, {
      maxAge: REF_COOKIE_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return response;
}

/**
 * Three unrelated jobs share this file because Next.js only runs one
 * middleware entry point per app:
 *
 * 1. Referral attribution (any route) — a shared referral link can point
 *    at the homepage, a specific event, or a specific listing, so this
 *    runs on virtually every request rather than being scoped like the
 *    other two jobs below. Sets a long-lived cookie so the attribution
 *    survives the visitor browsing a few pages before actually starting
 *    the signup wizard — see services/event-drafts.ts's createDraftEvent,
 *    which is where the cookie eventually gets consumed.
 * 2. /admin/* — refreshes the Supabase Auth session cookie on every
 *    request. Actual authorization (is this user an admin?) happens in
 *    app/admin/layout.tsx via the service-role client — this middleware's
 *    only job is keeping the session cookie alive, per the standard
 *    @supabase/ssr pattern.
 * 3. /pricing — detects the visitor's country from Netlify's injected
 *    geolocation and forwards it as a request header so the pricing
 *    page (a Server Component) can default to INR for India and USD
 *    everywhere else. See features/pricing/currency.ts for where this
 *    header is read.
 */
export async function middleware(request: NextRequest) {
  const refCode = sanitizeRefCode(request.nextUrl.searchParams.get("ref"));

  if (request.nextUrl.pathname.startsWith("/pricing")) {
    const geo = (request as unknown as NetlifyGeoRequest).geo;
    const countryCode = geo?.country?.code ?? request.headers.get("x-country-code") ?? "";
    const currency = countryCode.toUpperCase() === "IN" ? "INR" : "USD";

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CURRENCY_HEADER, currency);
    return withRefCookie(NextResponse.next({ request: { headers: requestHeaders } }), refCode);
  }

  if (!request.nextUrl.pathname.startsWith("/admin")) {
    // Every other route: no session to refresh, just carry the referral cookie forward.
    return withRefCookie(NextResponse.next({ request }), refCode);
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

  return withRefCookie(response, refCode);
}

export const config = {
  // Runs on every route except Next.js internals and static files, so
  // referral attribution (job 1 above) can catch a shared link to any
  // page — /admin/* and /pricing are already covered by this pattern,
  // the function body branches on pathname for jobs 2 and 3.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
