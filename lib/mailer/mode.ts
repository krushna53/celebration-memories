/**
 * Which backend the Corporate Event Mailer uses.
 *
 * - "mock": everything lives in the browser's LocalStorage, seeded with
 *   demo data, and sending is simulated. No Supabase query, migration or
 *   PostgreSQL connection is involved for Mailer data.
 * - "live": data in Firestore and campaigns sent for real through a verified
 *   Email Configuration (services/mailer/live-mailer.ts). Needs
 *   MAILER_EMAIL_CONFIG_STORE=firestore and the FIREBASE_* settings.
 * - "supabase": reserved for the real backend, which isn't built yet —
 *   the Mailer page shows a "not set up" notice in this mode.
 *
 * Mock mode only swaps where Mailer data is stored. It is not an access
 * control: /admin/mailer still requires an owner login through the normal
 * admin auth (app/admin/(dashboard)/layout.tsx + the page's own check).
 *
 * Read from NEXT_PUBLIC_MAILER_MODE, which Next.js inlines at build time,
 * so a change needs a dev-server restart / rebuild.
 */
export type MailerMode = "mock" | "live" | "supabase";

export function getMailerMode(): MailerMode {
  const mode = process.env.NEXT_PUBLIC_MAILER_MODE;
  return mode === "mock" || mode === "live" ? mode : "supabase";
}
