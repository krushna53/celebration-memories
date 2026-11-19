import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { SmtpSafeError } from "@/lib/mailer/email-config/smtp-errors";

/**
 * The SMTP host is typed by a company admin, and the server connects to
 * it — so it must not be usable to reach our own network (cloud metadata
 * at 169.254.169.254, localhost, private ranges). We resolve the name
 * ourselves, refuse if ANY address is non-public, and connect to the
 * checked address (TLS still verifies the certificate against the host
 * name), so a DNS answer can't change between the check and the connect.
 */

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return isPublicAddress(mapped[1]!);
    return !blocked.check(ip, "ipv6");
  }
  return false;
}

/** Resolves the SMTP host to one public address to connect to (IPv4 preferred). */
export async function resolvePublicAddress(host: string): Promise<string> {
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new SmtpSafeError("dns", `Couldn't find the SMTP host "${host}". Check the spelling.`);
  }
  if (addresses.length === 0) throw new SmtpSafeError("dns", `Couldn't find the SMTP host "${host}". Check the spelling.`);
  if (addresses.some((a) => !isPublicAddress(a.address))) {
    throw new SmtpSafeError("blocked_host", `"${host}" points to a private or reserved network address, which isn't allowed.`);
  }
  return (addresses.find((a) => a.family === 4) ?? addresses[0]!).address;
}
