/**
 * Human-readable byte formatting for the admin Storage dashboard
 * (services/storage-usage.ts). Binary (1024-based) units, matching how
 * Supabase Storage itself reports usage — not decimal (1000-based) SI
 * units, which would read as a slightly smaller, misleading number for
 * the same underlying byte count.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value < 10 && unitIndex > 0 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

/** Bytes as a plain GB number (2 decimal places), for chart values/sorting. */
export function bytesToGb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}
