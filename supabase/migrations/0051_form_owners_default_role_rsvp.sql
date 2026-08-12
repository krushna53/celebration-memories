-- New "Build a Form" accounts should default to the "rsvp" dashboard
-- view (only RSVP-category forms visible) rather than "owner" (sees
-- everything) — the product is primarily an RSVP-form tool, so a
-- first-time builder should land scoped to that by default and
-- explicitly switch to "All Forms" if they also build general-purpose
-- forms. Existing rows are left untouched (this only changes the
-- default applied to new inserts); services/custom-forms.ts's
-- createFormOwnerAccount upsert still never includes `role` in its
-- payload, so on-conflict updates never touch it either.
alter table form_owners alter column role set default 'rsvp';
