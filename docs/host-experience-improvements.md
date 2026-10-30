# Host setup and guest upload improvements

The website-only selection on the Goals screen now follows Occasion → Goals → Event Details → Template → Review. The Quick setup button saves that selection. Card-only, slideshow-only, combined goals, and drafts without goals retain the full applicable builder. Optional tools remain accessible from the dashboard; setup does not bypass account, plan, or publication requirements.

The review screen and both event host dashboards include a launch checklist. Event details are checked from saved data; timing, venue/joining instructions, access settings, and guest preview require the host's review. Review ticks are stored on the current device per event and reset when checklist-relevant settings change. Directory visibility is explicitly distinguished from restricting access to a direct link. This checklist is advisory and does not publish anything.

Guest uploads now guard against repeated clicks, retry transient failures up to twice with backoff, and preserve the uploaded object path when only final confirmation needs retrying. Confirmation validates the guest's path and Storage object and uses the path's UUID as a stable record ID, so concurrent or repeated confirmations create one unapproved memory. Existing saved records are returned unchanged. Activity logging cannot turn a saved memory into an apparent upload failure.

Unfinished local files, captions, and completed-transfer checkpoints are recovered using IndexedDB, scoped to a hash of the invitation token and media kind. Entries expire after 24 hours and are purged when recovery runs; completed or removed entries are deleted. Recovery never stores Google OAuth tokens. Private browsing, device eviction, or insufficient storage can prevent recovery; the queue explains when persistence fails. Google Photos remote videos may need selecting again after reload. Interrupted transfers restart the file, rather than resuming at a byte offset; a completed transfer retries only confirmation. Unfinished files are not automatically submitted after reload: the guest taps Upload/Retry.

## Verification

Run `npm run test:host-experience` for wizard routing, privacy wording, limited client serialization, concurrent/repeated confirmation, foreign path rejection, and missing-object checks. Run `npx tsc --noEmit`, ESLint on changed files, and `npm run build` for application checks.

Additional manual checks: create a private disposable draft; take Quick setup through template and review on phone and desktop widths; open the guest preview; tick checklist items and reload; change details and verify ticks reset. In a guest queue, select a local file, reload and recover it, then verify Retry after a network interruption and confirm that the host sees only one pending memory. Delete test drafts and uploaded objects afterward.

## Deployment

The Netlify middleware bundle requires an explicit `@opentelemetry/api` dependency. The lockfile is synchronized with the existing package manifest, including its Capacitor CLI dev dependency.

When using the local Netlify CLI, secret environment values returned by the API can be masked. Use `netlify build --offline --context production` with a validated `.env.local`, then `netlify deploy --no-build --prod` to deploy the packaged output. Hosted secret settings remain unchanged. Always check the final package and live deployment; a successful build alone does not establish that connection settings are valid.
