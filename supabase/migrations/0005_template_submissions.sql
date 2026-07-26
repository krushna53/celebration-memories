-- ============================================================================
-- Celebration Memories — community template submissions
-- Lets outside designers submit a config-only custom template (a palette
-- seeded from 3 base colors, a Google Font name, and a motion personality
-- — no custom code) via a public form. Owner reviews and approves/rejects;
-- approved rows get a generated `slug` and render live through the same
-- shared section tree every built-in template uses (see
-- templates/CommunityTemplate/index.tsx), with credit shown on the site.
-- ============================================================================

create table template_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  category text not null check (category in ('general', 'kids', 'formal', 'festive', 'romantic')),

  author_name text not null,
  author_website text,
  -- Contact only — never displayed publicly, only visible to the owner
  -- in the review queue.
  author_email text not null,

  -- Three seed colors the full 14-step palette is programmatically
  -- derived from (see lib/community-theme.ts) — asking a contributor for
  -- 14 individual hex values would be unreasonable.
  base_dark_color text not null,
  base_accent_color text not null,
  base_light_color text not null,

  -- Any Google Fonts family name (e.g. "Cormorant Garamond") — loaded at
  -- render time via a <link> tag, not next/font, specifically so a new
  -- font never requires a code deploy.
  font_display text not null,

  animation text not null check (
    animation in ('luxury', 'playful', 'energetic', 'dreamy', 'minimal', 'festive', 'jubilant')
  ),

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  -- Assigned only on approval (see approveTemplateSubmission in
  -- services/template-submissions.ts) — unique so it can double as the
  -- template's slug in the merged catalog alongside built-in templates.
  slug text unique,

  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index template_submissions_status_idx on template_submissions (status);

alter table template_submissions enable row level security;

-- Checked exclusively via the service-role client server-side (list/create/
-- approve/reject all go through Server Actions) — no public policy needed
-- or wanted here, matching the `admins` table's pattern.
