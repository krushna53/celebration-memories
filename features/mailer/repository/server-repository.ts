import type { AutomationRunResult, AutomationSettings, MailerBrand, MailerCampaign, MailerContact, MailerData, MailerEvent, MailerList, MailerSender, MailerTemplate } from "@/types/mailer";
import { MailerError, type MailerRepository } from "@/features/mailer/repository/types";

/**
 * Live-mode repository: every call goes to a Server Action
 * (features/mailer/actions.ts, or the dev preview's own), which works on
 * the company's data in Firestore and sends campaigns for real. The action
 * is passed in, so the same class serves the admin page and the preview.
 */

export type MailerCallResult = { success: true; data: unknown } | { success: false; error: string };
export type MailerCall = (method: string, args: unknown[]) => Promise<MailerCallResult>;

export class ServerMailerRepository implements MailerRepository {
  constructor(private readonly call: MailerCall) {}

  private async invoke<T>(method: string, ...args: unknown[]): Promise<T> {
    // Drop trailing undefined arguments — Server Actions serialise them as null.
    while (args.length && args[args.length - 1] === undefined) args.pop();
    const result = await this.call(method, args);
    if (!result.success) throw new MailerError(result.error);
    return result.data as T;
  }

  load = () => this.invoke<MailerData>("load");
  listEvents = () => this.invoke<MailerEvent[]>("listEvents");
  saveContact = (input: unknown, id?: string) => this.invoke<MailerContact>("saveContact", input, id);
  deleteContact = (id: string) => this.invoke<void>("deleteContact", id);
  importContacts = (inputs: unknown[], listId?: string | null) => this.invoke<MailerContact[]>("importContacts", inputs, listId);
  saveList = (input: unknown, id?: string) => this.invoke<MailerList>("saveList", input, id);
  deleteList = (id: string) => this.invoke<void>("deleteList", id);
  saveTemplate = (input: unknown, id?: string) => this.invoke<MailerTemplate>("saveTemplate", input, id);
  deleteTemplate = (id: string) => this.invoke<void>("deleteTemplate", id);
  saveCampaign = (input: unknown, id?: string) => this.invoke<MailerCampaign>("saveCampaign", input, id);
  deleteCampaign = (id: string) => this.invoke<void>("deleteCampaign", id);
  sendCampaign = (id: string, options?: { senderId?: string | null }) => this.invoke<MailerCampaign>("sendCampaign", id, options?.senderId ?? null);
  listSenders = () => this.invoke<MailerSender[]>("listSenders");
  saveAutomationSettings = (settings: unknown) => this.invoke<AutomationSettings>("saveAutomationSettings", settings);
  runAutomations = (options?: { date?: string | null }) => this.invoke<AutomationRunResult>("runAutomations", options?.date ?? null);
  saveBrandSettings = (input: unknown) => this.invoke<MailerBrand>("saveBrandSettings", input);
  /** Gets a one-time upload link from the server, puts the PNG straight into Storage, returns its public URL. */
  uploadLogo = async (png: Blob) => {
    const target = await this.invoke<{ signedUrl: string; publicUrl: string }>("requestLogoUpload", png.size);
    let put: Response;
    try {
      put = await fetch(target.signedUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: png });
    } catch {
      throw new MailerError("The logo upload didn't go through — check your connection and try again.");
    }
    if (!put.ok) throw new MailerError("The logo upload didn't go through — please try again.");
    return target.publicUrl;
  };
  resetDemoData = async () => {
    throw new MailerError("Demo data is only available in mock mode.");
  };
}
