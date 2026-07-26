# Business & Growth Guide

Answers to the operational questions around getting paid, pricing, custom domains, and positioning — none of this is code, all of it affects what to build next.

## Getting paid: Razorpay account setup

**Steps to activate an individual Razorpay account:**

1. Sign up at razorpay.com with your email/phone.
2. Submit KYC: a clear scan/photo of your Aadhaar card, and PAN details. As of January 2026, Razorpay offers instant Central KYC (CKYC) fast-track — if you have an existing CKYC record, verification can complete in minutes without video KYC or manual document upload.
3. Add your bank account (the name on the bank account must exactly match your PAN name — mismatches are the single biggest cause of onboarding delays, per Razorpay's own guidance).
4. Once approved, you can generate **Payment Links** or a **Payment Page** — shareable URLs that accept cards, UPI, netbanking, and wallets — no website integration required to start.

**Should you just share a UPI QR code instead?** For one-off donations, a static UPI QR (from any UPI app — GPay, PhonePe, or your bank's own) is genuinely the fastest option: zero setup, zero fees, money lands directly in your bank account. Use it for the "Support/Contribute" link today.

For actually *selling* event sites, though, a Razorpay Payment Link is worth the extra setup even at low volume, because it gives you: an automatic receipt/invoice for the customer, a reconciled record of who paid for what (so you can log it against the referral system already built), and it looks materially more professional than "scan my personal QR code" when someone is paying ₹2,000–₹10,000 for a service. Recommendation: UPI QR for donations now, Razorpay Payment Links once you're ready to actually charge customers for sites (should take under a day to activate given CKYC fast-track).

Sources: [Razorpay KYC onboarding guide](https://razorpay.com/blog/payment-gateway-kyc-onboarding-india/), [Razorpay business-type KYC documents](https://razorpay.com/docs/payments/business-types-kyc-documents/?preferred-country=IN)

## Pricing: what the market actually charges

**India — digital wedding/event invitation sites, 2026:**
- Budget/template-only: ₹200–₹999 one-time (pre-made template, names filled in, no real customization)
- Mid-range custom design (static/video invite, no full website): ₹900–₹1,200
- Website builders: ₹4,999 (single-page, basic RSVP) → ₹9,999 (multi-section, custom domain, gallery, RSVP + guest management — this tier is described as "most popular") → ₹19,999+ (cinematic AI video, password protection, live analytics)

**Global — wedding website builders:**
Zola, Minted, and WithJoy all give the *website itself* away free and only charge for a custom domain (~$15/year). They monetize through gift registries, not the site — a fundamentally different business model than a done-for-you agency service.

**Recommendation for Celebration Memories:**

Since this platform includes real operational depth the ₹4,999–₹9,999 India tier already competes on (RSVP + guest management, admin dashboard, moderation, analytics, check-in, WhatsApp integration) plus things that tier typically *doesn't* have (guest-uploaded Memory Wall, referral tracking, multiple template themes), price **India: ₹2,999–₹4,999 launch price** for a single event (positions below the ₹9,999 "premium" tier while clearly above templated ₹999 options — the differentiated feature set justifies it), with ₹999–₹1,999 as a stripped-down "starter" tier (no custom domain, single template) if you want a lower entry point.

For a foreign/global audience, don't try to beat Zola/Minted at "free website" — you can't sustain that without their registry revenue. Instead position as a premium *managed* alternative: **$29–$49 one-time per event**, or **$9–$15/month** if you move to a subscription model later. That's still far cheaper than a designer and clearly communicates "someone builds and runs this for you," which is the actual differentiator (see below).

Sources: [Digital wedding invitation cost India 2025](https://magicalstar.in/blog/digital-wedding-invitation-cost-india-2025/), [Wedding invitation website cost India 2026](https://rachnakardesigns.com/blog/wedding-invitation-website-cost-india), [Zola/Minted/WithJoy pricing](https://www.zola.com/expert-advice/best-wedding-websites)

## "Build free, pay to publish" — the right gating pattern

Don't put payment at the very start — that's the #1 reason trial users bounce before seeing any value. The pattern that works (Canva, Notion, most PLG SaaS): let the host build the *entire* site for free — Event Settings, template, gallery, timeline, everything — on a private preview link only they can see. Gate these specific things behind payment:

1. **Publishing / going public** — the site works in preview, but `/events/[slug]` (or the primary domain) 404s or shows a "coming soon" page until paid.
2. **Custom domain** — free tier gets a subdomain or shared-domain path; paid unlocks connecting their own domain.
3. **Removing "Built by Krushna Web Works" branding** — free tier keeps the footer credit; paid removes it.
4. **Guest cap / media storage cap** — free tier limited to, say, 20 guests and 50 uploads; paid unlocks the real limits.

This isn't built yet — it needs an `events.is_published` (or `plan_tier`) flag, a paywall screen component, and a working payment link to gate against. Happy to scaffold this next if you want to move on it; it's a contained addition on top of what already exists (the `events` table and admin flow are already structured to take one more field cleanly).

## Domains: connecting a GoDaddy domain to Netlify

You'll need to buy the domain yourself (I can't purchase things on your behalf) — but the connection steps once you own it:

1. In Netlify: **Site overview → Domain management → Add custom domain**, enter the domain (e.g. `www.yourevent.com`), confirm you own it.
2. In GoDaddy: **My Products → your domain → DNS → Manage DNS**.
3. Add/edit an **A record** for the root domain pointing to Netlify's load-balancer IP: `75.2.60.5`.
4. Add/edit a **CNAME record** for `www` pointing to your Netlify site's default subdomain (e.g. `your-site.netlify.app`).
5. Save, then wait for DNS propagation (usually under an hour, can take up to 24-48h).

Alternative: Netlify also sells domains directly through its own registrar, which skips the GoDaddy DNS dance entirely if you'd rather not manage two dashboards — worth it once you're doing this repeatedly for multiple customer events.

Source: [Connecting a GoDaddy domain to Netlify](https://mattmilici.medium.com/connect-a-custom-godaddy-domain-to-your-netlify-site-a48aa18191d7), [Netlify domains docs](https://docs.netlify.com/manage/domains/get-started-with-domains/)

## "Anyone could build this with Claude" — how to actually counter that

The honest answer: yes, the code was built with AI assistance — and that's increasingly true of most production software, not a weakness to hide. The real differentiators were never "nobody else could type this code." They're:

1. **It's a done-for-you service, not a DIY builder.** Zola/WithJoy make the couple build their own site. You build it *for* the customer, handle hosting, and fix things when they ask — that's the actual product, the code is just the delivery mechanism.
2. **Depth that takes real time to replicate, AI-assisted or not.** A moderation queue, per-guest visit tracking, day-of check-in, referral tracking, multi-template theming — someone "just using Claude" for an afternoon isn't going to have assembled and tested all of this together. Depth and integration are the moat, not secrecy about tooling.
3. **An ongoing product, not a one-off delivery.** Templates keep getting added, the platform keeps improving — a customer who bought a static site from a freelance designer doesn't get that.
4. **A portfolio and reputation.** Screenshots, testimonials, a track record of real events run on the platform — this is what actually converts skeptical customers, far more than defending the build process.
5. **White-label potential.** Letting other small agencies/planners resell this under their own brand turns "anyone can build one" into "I'll license you the whole platform" — a materially different pitch and a real second revenue line if you want to pursue it later.

Concrete features worth adding to widen the gap further: multi-channel reminders (SMS/email in addition to WhatsApp), a post-event auto-generated photo book/highlight reel, guest RSVP deadline nudges, a seating/table planner, and the white-label option above. None of these are urgent — flagging them as the next tier of differentiation once the core platform is selling.

## Self-serve signup — scope check

You also asked about "facilities for users to signup." That's a materially larger project than anything else in this guide: real authentication for customers (not just the admin login that exists today), billing/subscription state, and per-tenant isolation in the admin UI (see risk-analysis.md, #7 — the dashboard is currently single-event). Worth doing once you're ready to stop manually onboarding every customer over WhatsApp — but it deserves its own planning pass rather than being bolted on alongside everything else in this round. Say the word when you want to scope it.
