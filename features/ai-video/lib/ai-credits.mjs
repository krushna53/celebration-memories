// xAI prepaid API credits are denominated in USD, not subscription points.
export const creditUnits = (usd) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(usd)} USD credits`;
export const creditCents = (cents) => creditUnits(cents / 100);

export function prepaidBalanceUsd(payload) {
  const raw = payload?.total?.val;
  if (typeof raw !== "string" || !/^-?\d+$/.test(raw)) return null;
  const cents = Number(raw);
  if (!Number.isSafeInteger(cents)) return null;
  // Management API examples record prepaid purchases as negative USD cents.
  return Math.max(0, -cents / 100);
}
