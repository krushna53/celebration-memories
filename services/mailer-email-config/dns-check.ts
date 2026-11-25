import "server-only";
import { Resolver } from "node:dns/promises";

import type { DnsRecordCheck, DomainCheck } from "@/types/mailer-email-config";
import { evaluateDkim, evaluateDmarc, evaluateSpf, overallDomainStatus } from "@/lib/mailer/email-config/dns-evaluate";

/**
 * Looks up the From domain's SPF, DKIM and DMARC TXT records in public
 * DNS and judges them (lib/mailer/email-config/dns-evaluate.ts). This is
 * the only basis for the domain status — a working SMTP login says
 * nothing about DNS.
 */

class LookupFailed extends Error {}

function resolver(): Resolver {
  return new Resolver({ timeout: 3_000, tries: 2 });
}

/** TXT records at `name` (chunks joined); [] when there are none; throws LookupFailed on a DNS error. */
async function txt(r: Resolver, name: string): Promise<string[]> {
  try {
    return (await r.resolveTxt(name)).map((chunks) => chunks.join(""));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENODATA" || code === "ENOTFOUND") return [];
    throw new LookupFailed();
  }
}

const lookupFailed: DnsRecordCheck = { status: "pending", detail: "Couldn't look this up right now — try the check again in a minute.", record: null };

export async function checkDomain(domain: string, spfInclude: string | null, dkimSelector: string | null): Promise<DomainCheck> {
  const r = resolver();
  const [spf, dmarc, dkim] = await Promise.all([
    txt(r, domain).then((records) => evaluateSpf(records, spfInclude), () => lookupFailed),
    txt(r, `_dmarc.${domain}`).then(evaluateDmarc, () => lookupFailed),
    dkimSelector
      ? txt(r, `${dkimSelector}._domainkey.${domain}`).then((records) => evaluateDkim(records, dkimSelector), () => lookupFailed)
      : Promise.resolve(evaluateDkim(null, null)),
  ]);
  return { domain, spf, dkim, dmarc, overall: overallDomainStatus(spf, dkim, dmarc), checkedAt: new Date().toISOString() };
}
