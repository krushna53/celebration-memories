# Scale Risk Analysis

What breaks first as traffic, guest count, and media volume grow — and the concrete safeguard for each. Ordered roughly by "hits first" to "hits eventually."

## 1. Netlify function/bandwidth limits

**What breaks:** Netlify's free tier runs on a shared 300-credit/month pool (bandwidth costs 20 credits/GB, function compute 10 credits/GB-hour). A single viral public event — lots of guests loading galleries, videos, and the admin media-export zip — can burn through that fast. The Pro plan ($19–20/mo) gives 1TB bandwidth / ~3,000 credits; overage beyond any plan is billed at ~$20/100GB bandwidth and ~$25/million function invocations.

**Safeguard:** Move off the free tier before your first real public event (Pro tier is cheap insurance). Watch the Netlify usage dashboard for bandwidth trending up during an active event week. Video is the biggest bandwidth cost — see #3.

## 2. In-memory ZIP export (`/api/admin/media-export`)

**What breaks:** The bulk media-download route fetches every photo/video/audio file into memory and zips it in one function invocation. Fine for one family event's worth of uploads (tens to low hundreds of files); a large public event with hundreds of guests uploading video will hit the function's memory ceiling or execution timeout (Netlify functions default to 10s on lower tiers, up to 26s elsewhere) before finishing.

**Safeguard:** At scale, replace this with a background job: queue the export (e.g. a database row + a scheduled/triggered function), zip to Storage in chunks or stream directly rather than buffering the whole archive in memory, and email/notify the admin a download link when done. Until then, keep it as a manual admin action, not something exposed to guests.

## 3. Storage egress for photos/video

**What breaks:** Every gallery photo, guest video, and Memory Wall item is served straight from Supabase Storage's public URL. Video is the expensive one — a few dozen guests replaying a 50MB video several times each adds up fast, and this counts against Supabase's own bandwidth quota (separate from Netlify's).

**Safeguard:** Put a CDN/image-transformation layer in front of Storage for photos (Supabase has a built-in image transformation API on paid plans), cap video resolution/bitrate more aggressively at upload time, and consider a "thumbnail first, tap to load full video" pattern on the Memory Wall instead of auto-loading every video.

## 4. Supabase Postgres connections + row growth

**What breaks:** Every Server Action opens a connection via the service-role client. Under a sudden traffic spike (e.g. everyone RSVPing the same evening), concurrent connections can hit the project's pool limit. Row growth itself (RSVPs, uploads, activity logs) isn't a real concern until tens of millions of rows — connections and query patterns matter far sooner.

**Safeguard:** Use Supabase's connection pooler (PgBouncer, usually on by default for the pooled connection string) rather than direct connections once traffic is non-trivial. Add indexes on the columns you filter by most (`event_id` on every guest-facing table — already in place from the original migrations).

## 5. No queueing — everything is synchronous

**What breaks:** RSVP submission, signed-upload issuance, and the media export all run inline in a Server Action / Route Handler. There's no retry or background processing, so a slow Storage response or a Supabase blip becomes a failed request the guest sees directly.

**Safeguard:** Not urgent at current scale. If usage grows into "multiple simultaneous events with hundreds of guests each," move heavier operations (media export, bulk CSV import) to a background job runner instead of a request-response cycle.

## 6. Upload abuse safeguards are minimal

**What breaks:** The only anti-abuse measure today is a 40-file-per-invitee cap and file-type/size validation. There's no CAPTCHA, no IP rate limiting, and no protection against someone scripting repeated signed-upload requests against a single invite token.

**Safeguard:** Add IP-based rate limiting at the edge (Netlify Edge Functions or a lightweight middleware check) if abuse becomes a real problem — not necessary for a handful of family/friend events, worth revisiting before opening the platform to the general public at the `/events` directory scale.

## 7. Single-event admin dashboard

**What breaks:** The admin dashboard, Server Actions, and most `EVENT_SLUG`-based pages assume one "active" event. The schema is already multi-tenant (every table scoped by `event_id`), but the admin UI isn't — so today, running many events means many separate deployments/projects, not one dashboard managing all of them.

**Safeguard:** This is a real product-scope decision, not a bug: building an event-switcher in the admin UI (and moving `EVENT_SLUG` from a constant to a per-session selection) is the next architectural milestone before onboarding multiple paying customers onto one shared deployment.

## 8. RLS has no policies — service-role is the only gate

**What breaks:** Every table has Row Level Security *enabled* but *no policies*, which means the anon key can read/write nothing, and all access goes through the service-role key on the server. This is safe as designed, but it means there's no defense-in-depth: if the service-role key ever leaks (e.g. accidentally shipped in a client bundle), it bypasses everything.

**Safeguard:** Keep `SUPABASE_SERVICE_ROLE_KEY` server-only (already enforced via the `server-only` package import guard in every service file) and rotate it if a leak is ever suspected. As the platform grows, consider adding real RLS policies as a second layer rather than relying solely on "the key never leaves the server."

## 9. ISR revalidation cost across many public events

**What breaks:** Public pages revalidate every 60 seconds. With one event this is trivial; with hundreds of public events on the `/events` directory, that's hundreds of background regenerations per minute, each hitting Supabase.

**Safeguard:** Increase the revalidation window for lower-traffic events, or move to on-demand revalidation (`revalidatePath` is already called from every admin Server Action) instead of a blanket 60s timer — the infrastructure for this already exists, it just needs the timer removed once on-demand coverage is confirmed complete.

---

**Bottom line:** nothing here needs fixing today for a single family event. The order to actually act in, once you're selling this to other hosts: (1) upgrade off Netlify's free tier, (2) tighten video delivery, (3) build the admin event-switcher, (4) revisit upload abuse protection once the `/events` directory has real public traffic.
