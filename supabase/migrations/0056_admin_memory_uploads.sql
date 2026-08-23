-- Allow admins (owners and clients) to upload memories directly from the
-- admin panel, without needing a guest invitee row. This requires making
-- invitee_id nullable on all four memory tables and adding an
-- uploaded_by_admin_id FK so the upload is still attributable. A check
-- constraint enforces that every row still has exactly one identity:
-- either a guest's invitee_id OR an admin's uploaded_by_admin_id.

alter table photos
  alter column invitee_id drop not null,
  add column uploaded_by_admin_id uuid references admins (id) on delete set null;

alter table videos
  alter column invitee_id drop not null,
  add column uploaded_by_admin_id uuid references admins (id) on delete set null;

alter table audio
  alter column invitee_id drop not null,
  add column uploaded_by_admin_id uuid references admins (id) on delete set null;

alter table guestbook
  alter column invitee_id drop not null,
  add column uploaded_by_admin_id uuid references admins (id) on delete set null;

-- Exactly one of invitee_id / uploaded_by_admin_id must be set.
alter table photos
  add constraint photos_identity_check
  check (
    (invitee_id is not null and uploaded_by_admin_id is null) or
    (invitee_id is null     and uploaded_by_admin_id is not null)
  );

alter table videos
  add constraint videos_identity_check
  check (
    (invitee_id is not null and uploaded_by_admin_id is null) or
    (invitee_id is null     and uploaded_by_admin_id is not null)
  );

alter table audio
  add constraint audio_identity_check
  check (
    (invitee_id is not null and uploaded_by_admin_id is null) or
    (invitee_id is null     and uploaded_by_admin_id is not null)
  );

alter table guestbook
  add constraint guestbook_identity_check
  check (
    (invitee_id is not null and uploaded_by_admin_id is null) or
    (invitee_id is null     and uploaded_by_admin_id is not null)
  );

-- Indexes so admin-uploaded items are fast to query by admin.
create index photos_admin_idx   on photos   (uploaded_by_admin_id) where uploaded_by_admin_id is not null;
create index videos_admin_idx   on videos   (uploaded_by_admin_id) where uploaded_by_admin_id is not null;
create index audio_admin_idx    on audio    (uploaded_by_admin_id) where uploaded_by_admin_id is not null;
create index guestbook_admin_idx on guestbook (uploaded_by_admin_id) where uploaded_by_admin_id is not null;
