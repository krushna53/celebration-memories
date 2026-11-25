import type { CampaignAudience, MailerContact, MailerList } from "@/types/mailer";

export interface ResolvedAudience {
  /** Subscribed contacts to send to — each email address once. */
  recipients: MailerContact[];
  /** Picked (directly or via a list) but unsubscribed — never sent to. */
  unsubscribed: MailerContact[];
  /** Extra entries dropped because the same email was already included. */
  duplicates: number;
}

/** Turns a campaign's selected contacts + lists into the people it would actually go to. */
export function resolveAudience(
  audience: CampaignAudience,
  contacts: readonly MailerContact[],
  lists: readonly MailerList[],
): ResolvedAudience {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const ids = [
    ...audience.contactIds,
    ...lists.filter((l) => audience.listIds.includes(l.id)).flatMap((l) => l.contactIds),
  ];

  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const recipients: MailerContact[] = [];
  const unsubscribed: MailerContact[] = [];
  let duplicates = 0;

  for (const id of ids) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const contact = byId.get(id);
    if (!contact) continue; // deleted since it was picked
    if (!contact.subscribed) {
      unsubscribed.push(contact);
      continue;
    }
    if (seenEmails.has(contact.email)) {
      duplicates += 1;
      continue;
    }
    seenEmails.add(contact.email);
    recipients.push(contact);
  }

  return { recipients, unsubscribed, duplicates };
}
