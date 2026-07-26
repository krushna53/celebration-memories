# services/

Server-only data access layer — typed wrappers around Supabase queries,
always using the service-role client (`lib/supabase/admin.ts`) since
guests are authenticated by invite token rather than a Supabase Auth
session. Consumed from Server Components and Server Actions only; every
file starts with `import "server-only"` so accidentally importing one
from a Client Component fails at build time.

- `invitees.ts` — look up a guest by invite token (joined with their event).
- `tracking.ts` — log invitation opens/visits and generic activity events.
- `rsvps.ts` — create/update a guest's RSVP.

Phase 5 adds admin-facing services (invitee CRUD, CSV import, analytics
aggregation) here as well.
