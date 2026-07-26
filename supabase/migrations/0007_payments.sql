-- ============================================================================
-- Celebration Memories — manual UPI/QR payment collection
--
-- Not a payment gateway integration (no Razorpay/Stripe yet — see
-- docs/business-growth-guide.md for that path). This is the lightweight
-- v1: the owner uploads a QR code + payment details once, anyone (an
-- anonymous visitor or a logged-in client) can view it at /pay and
-- submit a "here's what I sent" confirmation with a reference number,
-- and the owner manually verifies against their bank/UPI app and marks
-- it confirmed at /admin/payments. No money moves through this platform
-- — it's a manual paper trail, not automated collection.
-- ============================================================================

-- Singleton settings row — the classic Postgres trick for "exactly one
-- row, always": a boolean primary key that can only ever be `true`.
create table payment_settings (
  id boolean primary key default true,
  qr_image_path text,
  upi_id text,
  bank_details text,
  instructions text,
  updated_at timestamptz not null default now(),
  constraint payment_settings_singleton check (id)
);

create table payment_submissions (
  id uuid primary key default gen_random_uuid(),
  payer_name text not null,
  payer_email text,
  payer_phone text,
  amount numeric(10, 2) not null,
  purpose text,
  reference_note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index payment_submissions_status_idx on payment_submissions (status);

alter table payment_settings enable row level security;
alter table payment_submissions enable row level security;

-- Checked exclusively via the service-role client server-side — no
-- public policy needed or wanted here, matching every other table.
