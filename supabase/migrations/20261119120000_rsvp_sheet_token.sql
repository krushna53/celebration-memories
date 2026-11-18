-- Live RSVP sheet (services/rsvp-sheet.ts): a secret per-event link that
-- serves the RSVP list as CSV, for a Google Sheet's =IMPORTDATA(...) in the
-- host's own Drive. Possession of the token is the credential, like an
-- invite link; null = no sheet link (the default). Regenerating replaces it,
-- which cuts off every sheet that used the old one.
alter table public.events add column if not exists rsvp_sheet_token text unique;
