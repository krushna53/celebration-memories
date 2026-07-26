import { EVENT_SLUG } from "@/lib/constants";
import { getEventBySlug } from "@/services/events";
import { GODADDY_CONFIGURED } from "@/lib/godaddy";
import { DomainSearchForm } from "@/features/admin/domain-search/domain-search-form";

export const dynamic = "force-dynamic";

// Available to owner and client roles (see lib/admin-roles.ts) — this is
// the client-facing "find a custom domain for my event" tool. No spend
// happens here: it only checks GoDaddy availability/pricing, purchase
// happens on GoDaddy's own site via a deep link.
export default async function AdminDomainSearchPage() {
  const event = await getEventBySlug(EVENT_SLUG);
  const suggestion = event ? event.slug.replace(/[^a-z0-9-]/gi, "") : "";

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Domain Search</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Search for a custom domain for your event (e.g. mahesh75.com) and see
        live availability and pricing. Purchase happens on GoDaddy&rsquo;s
        site — once you own it, point its DNS at Netlify to use it here.
      </p>
      <div className="mt-6">
        <DomainSearchForm configured={GODADDY_CONFIGURED} defaultQuery={suggestion} />
      </div>
    </div>
  );
}
