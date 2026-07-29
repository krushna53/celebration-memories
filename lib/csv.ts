/**
 * Minimal RFC 4180-ish CSV serializer — used for admin data exports
 * (see features/admin/invitees/actions.ts's exportRsvpCsvAction). Kept
 * dependency-free rather than reaching for PapaParse's unparse: this
 * only ever needs to go one direction (object rows -> CSV text) for a
 * small, known column set, so a few lines here are simpler than
 * confirming PapaParse's server-side behavior is identical to its
 * client-side (already-used-for-import) behavior.
 */
export interface CsvColumn<T> {
  key: keyof T;
  label: string;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote any cell containing a comma, quote, or newline — doubling
  // embedded quotes, per RFC 4180.
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(","));
  return [header, ...lines].join("\r\n");
}
