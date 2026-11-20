import Papa from "papaparse";

import { normalizeRoles, type MailerContactInput } from "@/types/mailer";
import { isValidEmail, normalizeEmail } from "@/lib/mailer/email";
import { normalizeDateInput } from "@/lib/mailer/automations";

/**
 * CSV → contacts for the Mailer's import screen. Pure (no storage
 * access): it takes the existing emails, and returns the rows to create
 * plus a per-row report the UI turns into the import summary.
 *
 * Headers are matched loosely ("First Name", "first_name", "firstname"
 * all work). A single "Name" column is split into first/last on the
 * first space when there are no separate name columns.
 */

const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  email: ["email", "emailaddress", "email_address", "mail", "e-mail"],
  firstName: ["firstname", "first_name", "first", "givenname"],
  lastName: ["lastname", "last_name", "last", "surname", "familyname"],
  name: ["name", "fullname", "full_name", "contactname"],
  company: ["company", "organisation", "organization", "org", "companyname"],
  phone: ["phone", "mobile", "phonenumber", "phone_number", "whatsapp", "contactnumber"],
  roles: ["role", "roles", "contactrole", "contactroles"],
  dateOfBirth: ["dob", "dateofbirth", "date_of_birth", "birthday", "birthdate", "birth_date"],
  joiningDate: ["joiningdate", "joining_date", "dateofjoining", "date_of_joining", "doj", "joindate", "join_date", "startdate", "start_date"],
};

interface ParsedRow {
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  company: string;
  phone: string;
  /** One cell, several roles: "Employee; Subscriber" (also , | / separators). Unknown roles are ignored. */
  roles: string;
  /** Any of 2026-11-19, 19-11-2026, 19/11/2026 — unreadable dates are left empty (the row is still imported). */
  dateOfBirth: string;
  joiningDate: string;
}

export type ImportRowOutcome = "imported" | "invalid_email" | "missing_email" | "duplicate_in_file" | "duplicate_existing";

export interface ImportRowReport {
  /** 1-based line number in the file, counting the header as line 1. */
  line: number;
  email: string;
  outcome: ImportRowOutcome;
}

export interface ImportAnalysis {
  totalRows: number;
  toImport: MailerContactInput[];
  rows: ImportRowReport[];
  counts: Record<ImportRowOutcome, number>;
  /** Set when the file couldn't be used at all (e.g. no email column). */
  fatalError: string | null;
}

function headerKey(header: string): keyof ParsedRow | null {
  const compact = header.trim().toLowerCase().replace(/[\s.]+/g, "");
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [keyof ParsedRow, string[]][]) {
    if (aliases.some((a) => a.replace(/[\s.]+/g, "") === compact)) return key;
  }
  return null;
}

export function analyzeContactCsv(
  csvText: string,
  existingEmails: Iterable<string>,
  defaults: { eventIds: string[]; roles?: string[] },
): ImportAnalysis {
  const counts: Record<ImportRowOutcome, number> = {
    imported: 0,
    invalid_email: 0,
    missing_email: 0,
    duplicate_in_file: 0,
    duplicate_existing: 0,
  };
  const empty: ImportAnalysis = { totalRows: 0, toImport: [], rows: [], counts, fatalError: null };

  // Strip a UTF-8 BOM (Excel adds one) so the first header still matches.
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });

  const fields = parsed.meta.fields ?? [];
  const mapping = new Map<string, keyof ParsedRow>();
  for (const field of fields) {
    const key = headerKey(field);
    if (key && ![...mapping.values()].includes(key)) mapping.set(field, key);
  }
  if (![...mapping.values()].includes("email")) {
    return { ...empty, fatalError: "No email column found. Add a column named \"Email\" and try again." };
  }

  const existing = new Set([...existingEmails].map(normalizeEmail));
  const seen = new Set<string>();
  const toImport: MailerContactInput[] = [];
  const rows: ImportRowReport[] = [];

  parsed.data.forEach((record, index) => {
    const row: ParsedRow = { email: "", firstName: "", lastName: "", name: "", company: "", phone: "", roles: "", dateOfBirth: "", joiningDate: "" };
    for (const [field, key] of mapping) row[key] = String(record[field] ?? "").trim();

    const line = index + 2;
    const email = normalizeEmail(row.email);
    let outcome: ImportRowOutcome;
    if (!email) outcome = "missing_email";
    else if (!isValidEmail(email)) outcome = "invalid_email";
    else if (seen.has(email)) outcome = "duplicate_in_file";
    else if (existing.has(email)) outcome = "duplicate_existing";
    else outcome = "imported";

    if (email) seen.add(email);
    counts[outcome] += 1;
    rows.push({ line, email: row.email, outcome });

    if (outcome === "imported") {
      let { firstName, lastName } = row;
      if (!firstName && !lastName && row.name) {
        const [first, ...rest] = row.name.split(/\s+/);
        firstName = first ?? "";
        lastName = rest.join(" ");
      }
      toImport.push({
        firstName,
        lastName,
        email,
        company: row.company,
        phone: row.phone,
        eventIds: [...defaults.eventIds],
        roles: normalizeRoles([...row.roles.split(/[;,|/]/), ...(defaults.roles ?? [])]),
        dateOfBirth: normalizeDateInput(row.dateOfBirth) ?? "",
        joiningDate: normalizeDateInput(row.joiningDate) ?? "",
        subscribed: true,
      });
    }
  });

  return { totalRows: parsed.data.length, toImport, rows, counts, fatalError: null };
}

export const IMPORT_OUTCOME_LABELS: Record<ImportRowOutcome, string> = {
  imported: "Imported",
  invalid_email: "Invalid email",
  missing_email: "Missing email",
  duplicate_in_file: "Duplicate in file",
  duplicate_existing: "Already a contact",
};

/** A small file people can download to see the expected columns. */
export const SAMPLE_CONTACTS_CSV = `First Name,Last Name,Email,Company,Phone,Roles,Date of Birth,Joining Date
Ananya,Iyer,ananya.iyer@globex.example,Globex Corp,+91 98200 11111,Client; Partner,,
Rahul,Mehta,rahul.mehta@initech.example,Initech,+91 98200 22222,Employee; Subscriber,1994-08-21,2022-04-01
Pooja,Nair,pooja.nair@initech.example,Initech,,HR; Employee,15/02/1990,01/06/2019
`;
