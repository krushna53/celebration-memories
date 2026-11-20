import { MailerError, type MailerRepository } from "@/features/mailer/repository/types";

/**
 * Placeholder for the real Mailer backend. There are no Mailer tables,
 * migrations or Server Actions yet, so every call fails with a clear
 * message instead of guessing at a schema.
 *
 * To build it: add the tables in a supabase/migrations file, Server
 * Actions in features/mailer/actions.ts that call requireOwner() (or
 * requireAdminForEvent()) and supabaseAdmin(), following the
 * `{ success, data | error }` convention, and implement each method
 * below by calling those actions. sendCampaign would go through a real
 * provider (e.g. Resend, already used by lib/email) instead of
 * lib/mailer/simulate.ts. The UI won't need to change.
 */
const NOT_READY =
  "The Mailer database isn't set up yet. Set NEXT_PUBLIC_MAILER_MODE=mock to try it with demo data.";

function notReady(): never {
  throw new MailerError(NOT_READY);
}

export class SupabaseMailerRepository implements MailerRepository {
  load = async () => notReady();
  listEvents = async () => notReady();
  saveContact = async () => notReady();
  deleteContact = async () => notReady();
  importContacts = async () => notReady();
  saveList = async () => notReady();
  deleteList = async () => notReady();
  saveTemplate = async () => notReady();
  deleteTemplate = async () => notReady();
  saveCampaign = async () => notReady();
  deleteCampaign = async () => notReady();
  sendCampaign = async () => notReady();
  listSenders = async () => notReady();
  saveAutomationSettings = async () => notReady();
  runAutomations = async () => notReady();
  resetDemoData = async () => notReady();
}
