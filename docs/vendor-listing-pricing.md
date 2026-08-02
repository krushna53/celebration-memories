# Vendor Listing Pricing — Photographers, Makeup Artists, Magicians

Written by Claude, August 2026, in response to: "charge them an amount
which you can suggest to list them on the portal... it should be
competitive and also ensure that it's affordable."

## Where things stand today

`app/business/page.tsx` currently advertises, in two places: **"Free to
list. No commission on leads or bookings."** No payment provider is
wired into the Business/Marketplace flow anywhere (`features/business/`,
`services/marketplace-listings.ts` — confirmed, zero Stripe/Razorpay
references). This is a real, live, public claim on the marketing page
right now, not just a default — flipping it to a paid model is a
business-model change with real consequences (every vendor who signed
up under "free" would need to be grandfathered or told about the
change), so **I have not touched that copy or built payment collection
tonight.** This doc is the recommendation + a concrete implementation
plan, ready to execute once you sign off on a number.

## Market context (checked August 2026)

WedMeGood — the dominant Indian wedding-vendor directory, with far more
guest/host traffic than EveryMoment has today — charges vendors roughly
₹50,000–₹85,000 for a 6–12 month "premium" listing package (per vendor
reviews; WedMeGood has no public rate card). That price only makes
sense because of the lead volume WedMeGood already has. EveryMoment is
a young platform — charging anywhere near that would be neither
competitive nor affordable for a photographer/makeup artist/magician
who has no evidence yet of how many leads they'll actually get.

## Recommendation: freemium, not a flat paywall

Keep the "Free to list" claim — don't paywall the basic listing at
all. A new marketplace's hardest problem is supply-side liquidity (few
vendors → few listings → hosts don't bother checking → still fewer
vendors). Charging a fee for the *basic* listing right now would work
against the platform's own growth. Instead:

**Free tier (today's model, keep as-is):** profile, gallery, services,
FAQs, contact info, appears in category/city search — everything
`business_profiles`/`business_gallery`/`business_services`/
`business_faqs` already supports.

**Paid "Featured" tier — recommended ₹499/month or ₹4,999/year (17%
discount for annual, encourages commitment over month-to-month churn):**
- Featured placement (top of category/city results — `is_featured` on
  `business_profiles` already exists as a column, just currently only
  settable by an admin, not self-serve/paid)
- A "Verified" badge (`is_verified` — same situation, admin-only today)
- Priority in the AI Avatar's vendor suggestions, if/when that's ever
  extended to recommend vendors to guests
- Multiple listings under one account (the DB already supports this —
  `listListingsForAccount` returns an array — but no UI surfaces it
  today; could be a Featured-tier perk, e.g. a photographer who also
  does videography)

This is deliberately similar in shape to how `events.ai_image_generation_limit`
etc. work — a free base tier with a paid multiplier — a pattern already
established elsewhere in this codebase, not a new concept for the
project.

**Why ₹499/mo specifically:** cheap enough that a solo makeup artist or
magician (lower average deal size than a wedding photographer) can try
it for one busy season without real financial risk, but high enough to
filter for vendors who are serious about the platform rather than
window-shopping. It's roughly what a single small Instagram/Facebook
boost ad costs for a day or two — a fair anchor, since that's the
realistic alternative use of that money for a small vendor.

**Do NOT charge different prices per category** (photographer vs.
makeup artist vs. magician) — same reasoning `services/marketplace-categories.ts`'s
comment already gives for not varying pricing/commission by category:
it adds real complexity (a `category_pricing` table, per-category
billing logic) for a distinction hosts and vendors won't reliably
understand or trust ("why does a photographer pay more than a
magician?").

## What's needed to actually turn this on

1. **Your sign-off on the number** — ₹499/mo · ₹4,999/yr is my
   recommendation, not a decision I should make unilaterally since it's
   real money changing hands and changes a live public claim.
2. A `plan` column on `business_profiles` (`'free' | 'featured'`,
   default `'free'`) — small migration, no risk, can ship immediately
   whenever you want it, independent of payment wiring.
3. Wire Razorpay (already integrated elsewhere in this codebase —
   `lib/razorpay.ts`, used by the event-host onboarding wizard's
   payment step) into a new self-serve "Upgrade to Featured" action on
   the vendor dashboard, mirroring `services/wizard-payments.ts`'s
   pattern rather than inventing a new one. Recurring monthly billing
   needs Razorpay Subscriptions specifically (a different API surface
   than the one-time payment flow the wizard uses today) — flagging
   that now so it isn't assumed to be a copy-paste of existing code.
4. Update `app/business/page.tsx`'s copy from "Free to list. No
   commission" to something like "Free to list. Optional Featured
   placement from ₹499/mo." once the above is built and you've decided
   to go live with it.

I've deliberately stopped short of building #2–#4 tonight — wiring up
real payment collection and changing a live pricing claim without you
able to review the exact number and copy first is exactly the kind of
thing that should wait for your go-ahead rather than ship while you're
asleep.
