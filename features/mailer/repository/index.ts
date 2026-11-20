import type { MailerMode } from "@/lib/mailer/mode";
import { browserStore, LocalStorageMailerRepository } from "@/features/mailer/repository/local-storage-repository";
import { ServerMailerRepository, type MailerCall } from "@/features/mailer/repository/server-repository";
import { SupabaseMailerRepository } from "@/features/mailer/repository/supabase-repository";
import type { MailerRepository } from "@/features/mailer/repository/types";

export { MailerError, type MailerRepository } from "@/features/mailer/repository/types";
export type { MailerCall } from "@/features/mailer/repository/server-repository";

/** Picks the repository for the current mode. Browser-only (mock mode needs window.localStorage). */
export function createMailerRepository(mode: MailerMode, call?: MailerCall): MailerRepository {
  if (mode === "mock") return new LocalStorageMailerRepository(browserStore());
  if (mode === "live" && call) return new ServerMailerRepository(call);
  return new SupabaseMailerRepository();
}
