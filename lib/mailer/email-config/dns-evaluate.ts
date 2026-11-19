import type { DnsRecordCheck, DnsRecordStatus } from "@/types/mailer-email-config";

/**
 * Judges SPF / DKIM / DMARC from TXT records already fetched
 * (services/mailer-email-config/dns-check.ts does the lookups). Pure, so
 * it's unit-tested. It reports what public DNS says — it can't see inside
 * the provider, so wording stays honest ("pending" when we can't confirm).
 */

const check = (status: DnsRecordStatus, detail: string, record: string | null = null): DnsRecordCheck => ({ status, detail, record });

/** SPF: exactly one v=spf1 record that (when the provider has a fixed one) includes the provider. */
export function evaluateSpf(txtRecords: string[], spfInclude: string | null): DnsRecordCheck {
  const spf = txtRecords.filter((r) => /^v=spf1(\s|$)/i.test(r.trim()));
  if (spf.length === 0) return check("not_configured", "No SPF record found on this domain.");
  if (spf.length > 1) return check("issue", "This domain has more than one SPF record — merge them into one, or receivers treat SPF as broken.", spf.join(" | "));
  const record = spf[0]!.trim();
  const terms = record.toLowerCase().split(/\s+/);
  if (terms.some((t) => t === "+all" || t === "all")) return check("issue", "The SPF record ends in +all, which lets anyone send as this domain.", record);
  if (spfInclude) {
    const wanted = `include:${spfInclude.toLowerCase()}`;
    if (terms.some((t) => t.replace(/^[+~?-]/, "") === wanted)) return check("verified", `SPF authorises the provider (include:${spfInclude}).`, record);
    return check("issue", `SPF record found, but it doesn't list include:${spfInclude}. Add it (unless it's already included through another record).`, record);
  }
  return check("pending", "SPF record found. Confirm with your provider that it authorises their servers — that can't be checked from here.", record);
}

/** DMARC: one v=DMARC1 record with a policy. p=none is valid (monitoring) but noted. */
export function evaluateDmarc(txtRecords: string[]): DnsRecordCheck {
  const dmarc = txtRecords.filter((r) => /^v=dmarc1\s*(;|$)/i.test(r.trim()));
  if (dmarc.length === 0) return check("not_configured", "No DMARC record found at _dmarc on this domain.");
  if (dmarc.length > 1) return check("issue", "There is more than one DMARC record — keep exactly one.", dmarc.join(" | "));
  const record = dmarc[0]!.trim();
  const policy = /(?:^|;)\s*p\s*=\s*([a-z]+)/i.exec(record)?.[1]?.toLowerCase();
  if (!policy || !["none", "quarantine", "reject"].includes(policy)) return check("issue", "The DMARC record has no valid policy (p=none, quarantine or reject).", record);
  if (policy === "none") return check("verified", "DMARC is published in monitoring mode (p=none). Consider p=quarantine once mail passes.", record);
  return check("verified", `DMARC is published (p=${policy}).`, record);
}

/** DKIM: the selector's TXT record must carry a public key (p=…). Without a selector we can't look it up. */
export function evaluateDkim(txtRecords: string[] | null, selector: string | null): DnsRecordCheck {
  if (!selector || txtRecords === null) return check("pending", "Enter the DKIM selector your provider gave you to check DKIM.");
  if (txtRecords.length === 0) return check("not_configured", `No DKIM record found at ${selector}._domainkey.`);
  const record = txtRecords.find((r) => /(?:^|;)\s*p\s*=/i.test(r)) ?? null;
  if (!record) return check("issue", `A record exists at ${selector}._domainkey but it isn't a DKIM key.`, txtRecords.join(" | "));
  const key = /(?:^|;)\s*p\s*=\s*([^;]*)/i.exec(record)?.[1]?.trim() ?? "";
  if (!key) return check("issue", "The DKIM record has an empty key (p=), which means the key was revoked.", record.trim());
  return check("verified", `DKIM key published for selector "${selector}".`, record.trim());
}

/** One status for the domain: any issue wins, then anything missing, then anything unconfirmed. */
export function overallDomainStatus(...checks: DnsRecordCheck[]): DnsRecordStatus {
  if (checks.some((c) => c.status === "issue")) return "issue";
  if (checks.some((c) => c.status === "not_configured")) return "not_configured";
  if (checks.some((c) => c.status === "pending")) return "pending";
  return "verified";
}

export const DNS_STATUS_LABELS: Record<DnsRecordStatus, string> = {
  not_configured: "Not configured",
  pending: "Pending verification",
  verified: "Verified",
  issue: "Configuration issue",
};
