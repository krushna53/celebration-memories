# Platform Questions — Round 3

Answers to the 21 questions from this session that aren't already covered in `docs/business-growth-guide.md` (pricing, Razorpay, GoDaddy→Netlify DNS, self-serve signup scope) or `docs/risk-analysis.md` (scaling risks, traffic spikes, multi-tenant readiness). Built this round: notices ("no gifts" etc), a category-aware wish-message section, four new event categories (obituary/workshop/education/live-stream), a sitemap, and robots.txt. Everything else below is design/feasibility — none of it is built yet, several items need your input before starting (see the questions at the bottom).

## 1. Custom domain cost + independent domains per event

A `.com` runs about $5 the first year at GoDaddy, then renews around $22–23/year — other TLDs vary (`.in` is typically cheaper, ~₹500–800/year). That's per domain, and multi-tenant means each paying client would want their own.

Making that work technically: right now every event lives at `/events/[slug]` on one shared domain. To let `client-a.com` and `client-b.com` each point straight at their own event on the same Netlify site, the app needs **host-based routing** — a `custom_domain` column on `events`, and Next.js middleware that reads the incoming `Host` header and resolves it to the right event instead of relying on the URL slug. On the Netlify side, each domain then gets added as a **domain alias** to the one site (via dashboard or Netlify's API), and the client points their DNS at Netlify the same way described in the business guide. This is a real feature to build, not a quick tweak — it touches routing, the event lookup, and OG/metadata generation. Worth doing once you have paying clients who want their own domain, not before.

## 8. Migration readiness: Supabase → MySQL or another provider

Two different questions bundled here — worth separating:

**Moving the *website's* domain** (e.g., off `.netlify.app` onto your own domain, or between hosts) is trivial — DNS only, no code changes, covered in the business guide.

**Moving the *database* off Supabase to MySQL** is a substantial rewrite, not a config change. Every one of the ~20 `services/*.ts` files talks to Supabase's client library directly (no ORM abstraction layer sitting between the code and Postgres-specific syntax). Concretely, a MySQL migration means: rewriting every query in every service file, replacing `jsonb` columns (used for `section_config`, gallery categories, etc.) with MySQL's JSON type or normalized tables, replacing native Postgres enums with CHECK constraints or lookup tables, replacing Supabase Storage (file uploads) with S3/Cloudflare R2/similar, and replacing Supabase Auth (admin login) with a different auth provider or a hand-rolled one. Realistically a multi-week project, not something to do speculatively — only worth it if you hit a specific Supabase limitation (cost at scale, a missing feature, a compliance requirement) that MySQL specifically solves. If cost is the concern, Supabase's own paid tiers (see #14 below) are usually cheaper than the engineering cost of a full migration.

## 10. A review page for the platform

I can build a `/reviews` (or similar) public page — but I don't want to fabricate testimonials. Once you have a few real client quotes (even a WhatsApp message you can paraphrase with permission), send them over and I'll build a proper page with photos/names/quotes, styled to match the site. Until then it'd just be empty or fake, which would hurt more than help.

## 11. Making `/` the app homepage, events on separate URLs — and OG video

This is very achievable — `/platform` already *is* the marketing/app-info page in all but name, and every event already has its own URL at `/events/[slug]`. The only thing tying the current event to the root `/` is that `app/page.tsx` renders `EVENT_SLUG`'s event directly for backward compatibility. Flipping it means: `app/page.tsx` renders the platform marketing content (or redirects to `/platform`), and Mahesh's event moves fully to `/events/mahesh-75th-birthday`. The main thing to plan for: anyone who already has the root URL bookmarked or shared on WhatsApp needs a redirect, not a dead link — easy to add, just needs deciding on the target URL first.

**`og:video`** — it exists in the Open Graph spec, but in practice WhatsApp (and Facebook's own feed previews, mostly) don't autoplay it in link previews the way `og:image` renders as a thumbnail. What actually happens: the crawler still shows a static image (from `og:image`), and tapping the link opens the page in-browser where a real `<video>` plays. So there's no realistic way to get an inline-playing video preview inside a WhatsApp chat bubble — `og:image` (already working) is the ceiling for what a link preview can show.

## 12. Privacy — what's already in place and what it means

`/privacy` already exists and covers what's collected, why, where it's stored, and how to request deletion — worth a read if you haven't lately. On the technical side, guest and RSVP data stays private through a few concrete mechanisms already built: every database table has Row Level Security *enabled with zero public policies*, meaning the anonymous/public API key can't read or write anything at all — every single read and write goes through the service-role key, which only ever runs server-side (enforced by a `server-only` import guard in every service file, which makes the build itself fail if that code accidentally gets pulled into a browser bundle). No guest data is sent to third parties beyond the integrations you've explicitly wired up (Resend for email, OpenAI for the AI Image tool, Microsoft Clarity for analytics) — and Clarity specifically only sees anonymized session/interaction data, not RSVP or contact details. The main things worth actively doing as you take on real clients: have a clear process for what happens to guest data after an event ends (the privacy page mentions "reasonable period," which should probably become a concrete retention policy), and never paste real guest phone numbers/emails into a support request or bug report to me or anyone else.

## 13. Hosting AI Image on a separate provider

Doable, and it's the real fix for the Netlify timeout, not just the quality/timeout tweaks made earlier this session. The idea: instead of the "Generate" button submitting to a Next.js Server Action (which runs as a Netlify Function, capped at 10–26s), it calls a small standalone API endpoint deployed elsewhere — Vercel (functions run up to 60s+ on paid tiers), a Cloudflare Worker, or a tiny Railway/Render service — that owns the OpenAI call and its own `OPENAI_API_KEY`.

**How it still shows up on the Netlify-hosted page:** the `/admin/ai-image` page itself keeps living on Netlify exactly as now (auth check, quota check, the form UI) — only the actual "generate" network call changes from a Server Action to a plain `fetch()` from the browser straight to the external endpoint's URL, the same way any page calls a third-party API. The response (the generated image) comes back to the browser, which then hands it to the existing "Use as Link Preview / Add to Gallery" Server Actions to save it — those stay on Netlify since they're fast, no OpenAI wait involved. Net effect: one small extra service to deploy and maintain (with its own env var and a CORS allowlist for your domain), in exchange for no more 502s regardless of how long generation takes.

## 14. Where uploads are stored, and how much storage is realistic

Everything guests upload (photos, videos, audio) and everything the admin tools generate (AI images, share images) lives in **Supabase Storage** — object storage similar to S3, organized into buckets (`photos`, `videos`, `audio`, `gallery`, `hero`, `avatars` per the original spec). Each file's public URL is what gets served directly to browsers; nothing routes through your Netlify functions for serving media.

Cost: Supabase's free tier includes 1GB of file storage and 5GB of egress (download) bandwidth per month — fine for a single family event. On the Pro plan ($25/mo base), you get considerably more included, and storage beyond that runs about $0.125/GB/month, with egress billed separately. Video is what eats this fastest — a handful of guests each uploading and replaying a 50MB video repeatedly adds up in egress far quicker than storage itself becomes the bottleneck (this is also flagged in `docs/risk-analysis.md`, #3, with the mitigation: cap video bitrate/resolution more aggressively at upload, and don't auto-play every video on the Memory Wall).

## 15. Clients booking a hotel and listing it as the venue

Feasible, but it's a real partnership, not something I can fabricate a working integration for today. The venue-details fields already support a name/address/maps link/parking info for any venue including a hotel — that part works right now with zero new code, a client can just type a hotel's info in. Actual *in-platform booking* (search hotels, see rates, reserve a room block) needs a travel/hotel booking API — Booking.com's Affiliate/Partner API, RateHawk, or similar — each of which requires signing up as a registered affiliate/partner (often requiring a registered business entity and an approval process, similar to the GoDaddy reseller requirement in #9). A lighter first step that needs no partnership approval: a "Find a room block" button that deep-links to a Booking.com or Google Hotels search pre-filled with the venue's city and event dates — not true in-platform booking, but immediately buildable and still useful to guests.

## 16. Amazon product monetization

The standard, legitimate path is the **Amazon Associates** affiliate program — sign up in your country (India has its own Amazon Associates program, separate from the US one), get an approval and a tracking tag, and then any Amazon product link you build with that tag earns a commission on purchases. A natural fit for this platform: a "Gift Registry / Wish List" section where the host adds Amazon product links (by pasting a URL or ASIN), rendered nicely for guests to browse and buy directly on Amazon — this is a common pattern on wedding/baby-shower sites and doesn't require anything beyond the free Associates signup. I can build the picker/display UI once you have an Associates tag; I can't sign up for the affiliate program on your behalf (it needs your own tax/bank details).

## 17. Protecting the idea — patent, and what actually works

Being direct about this one: a patent is very unlikely to be the right tool here, and I'd rather tell you that now than have you spend money finding out. In India specifically, business methods and "a computer program per se" are explicitly excluded from patentability by law — courts have repeatedly held that dressing a business method in technical language doesn't change that. In the US it's not flatly excluded, but the 2014 *Alice Corp. v. CLS Bank* Supreme Court decision set a bar that most "an app that does X" patent applications fail — examiners routinely reject anything that reduces to "a familiar business practice, implemented on a computer," and a personalized-invitation-and-RSVP platform is squarely the kind of thing that description fits. A patent attorney would very likely tell you the same thing after a paid consultation, so hearing it for free first seems worth more than the consultation fee.

What actually does protect you, and is either free or cheap:

**Copyright** protects the actual code, the written copy, and original design/artwork automatically, the moment you create it — no registration needed, though registering it (in India via the Copyright Office, cheap and fast) makes it easier to prove and enforce if you ever need to.

**Trademark** protects your brand name and logo ("Celebration Memories," "Krushna Web Works") from being used by a competitor — this is the one actually worth spending money on early, since a copycat using your exact name is a more realistic risk than someone independently building similar software.

**Trade secret** protection covers things you keep genuinely confidential — your pricing model, your client list, your internal processes — simply by not publishing them and having anyone with access sign a basic confidentiality/NDA clause.

If there's a specific technical mechanism you've built that's genuinely novel (not "a website with RSVP and photo uploads," but some particular new technique), that narrower thing could be patentable — that's worth a real conversation with a patent attorney, scoped to that specific mechanism rather than "the whole idea."

## 19 & 20. QR code payment collection + a pay page for anonymous/client users

This is buildable as a lightweight v1 payment flow — the manual-UPI-QR approach the business guide already recommends for donations, extended into a real (if manual) payment feature: an admin settings page to upload a QR code image and payment details (UPI ID, bank details, whatever's relevant), and a public payment page where a user scans/pays externally in their own UPI app, then clicks "I've paid" with an optional reference/transaction ID, which lands in an admin queue for manual verification — very similar in shape to the Contact/Inquiries flow already built. This is a real, shippable feature with no payment gateway account needed. The tradeoff versus Razorpay (also covered in the business guide): no automatic verification, no instant receipt, and someone has to manually check the bank/UPI app matches up before marking a payment confirmed — acceptable at low volume, would get tedious past a handful of transactions a week.

## 21. AI video generation, external tools, and a mobile (WebView) app

**AI video generation** is a meaningfully bigger undertaking than AI Image, on every axis: the models (Runway, Pika, Google Veo, Sora) cost several times more per generation, and generation routinely takes minutes rather than seconds — meaning it *needs* the same "call an externally-hosted endpoint directly from the browser" pattern described in #13, not as an optional nice-to-have but as a hard requirement (no serverless function on any platform will hold a request open for minutes).

A meaningfully cheaper and more immediately buildable alternative, given you already have guest-uploaded photos/videos/audio sitting in Storage: a **slideshow-style video composer** — turn a set of photos into a music-backed video with simple pan/zoom (a "Ken Burns" effect) and transitions, using `ffmpeg` either in-browser (`ffmpeg.wasm`, free, but slow and limited by the visitor's device) or as a small background job on a separate host (fast, costs compute time but not per-generation API fees). This isn't "AI video" in the generative sense, but it directly serves what you described — turning uploaded images/video/audio into a finished video — at a fraction of the cost and complexity.

**External tools today, with zero new code:** hosts can already build a video themselves in Canva, CapCut, or InShot (all free or freemium) and just upload the finished file as their Gallery/Hero video — fully supported right now.

**A mobile (WebView) app** is genuinely one of the more straightforward asks on this list. Wrapping the existing website in a thin native shell (Capacitor is the standard tool for this) gives you an installable app without rebuilding any UI — and because it's the same website inside a WebView, the same login/session, the same AI Image tool, and any future AI Video tool all work identically with no separate backend or duplicate auth system needed. The main work is packaging (app icons, splash screen, store listing) and going through Apple's/Google's app review process, not rebuilding functionality.

---

## What I need from you before building the bigger items

Several of these are real features I can start on, but they involve money, third-party accounts, or product-direction decisions that are yours to make, not mine to assume.
