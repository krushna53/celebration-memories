"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";

import { CONTACT_ROLES, type ContactRole, type MailerContact, type MailerContactInput } from "@/types/mailer";
import { contactDisplayName, isValidEmail, normalizeEmail } from "@/lib/mailer/email";
import { useMailer } from "@/features/mailer/mailer-provider";
import { CsvImportDialog } from "@/features/mailer/components/csv-import-dialog";
import {
  Card,
  EmptyState,
  ErrorText,
  Field,
  inputClasses,
  Modal,
  primaryButton,
  SearchInput,
  secondaryButton,
} from "@/features/mailer/components/ui";
import { SAMPLE_CONTACTS_CSV } from "@/lib/mailer/csv-import";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const ROLE_LABEL = new Map(CONTACT_ROLES.map((r) => [r.role, r.label]));

function RoleTags({ roles }: { roles: ContactRole[] }) {
  if (roles.length === 0) return <span className="text-navy-700/40">—</span>;
  return (
    <div className="flex max-w-[200px] flex-wrap gap-1">
      {roles.map((r) => (
        <span key={r} className="rounded-md bg-navy-950/[0.06] px-1.5 py-0.5 text-xs text-navy-950">
          {ROLE_LABEL.get(r) ?? r}
        </span>
      ))}
    </div>
  );
}

export function ContactsView() {
  const { data, run } = useMailer();
  const [query, setQuery] = useState("");
  const [eventId, setEventId] = useState("all");
  const [listId, setListId] = useState("all");
  const [role, setRole] = useState<"all" | "none" | ContactRole>("all");
  const [subscription, setSubscription] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [editing, setEditing] = useState<MailerContact | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);

  const eventName = useMemo(() => new Map(data.events.map((e) => [e.id, e.name])), [data.events]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data.lists.find((l) => l.id === listId);
    return data.contacts
      .filter((c) => eventId === "all" || (eventId === "none" ? c.eventIds.length === 0 : c.eventIds.includes(eventId)))
      .filter((c) => listId === "all" || (list?.contactIds.includes(c.id) ?? false))
      .filter((c) => role === "all" || (role === "none" ? c.roles.length === 0 : c.roles.includes(role)))
      .filter((c) => subscription === "all" || (subscription === "subscribed") === c.subscribed)
      .filter(
        (c) =>
          !q ||
          contactDisplayName(c).toLowerCase().includes(q) ||
          c.email.includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.phone.includes(q),
      )
      .sort((a, b) => contactDisplayName(a).localeCompare(contactDisplayName(b)));
  }, [data.contacts, data.lists, query, eventId, listId, role, subscription]);

  async function remove(contact: MailerContact) {
    if (!confirm(`Delete ${contactDisplayName(contact)}? They'll also be removed from lists and draft campaigns.`)) return;
    const result = await run((repo) => repo.deleteContact(contact.id));
    setError(result.ok ? null : result.error);
  }

  function downloadSample() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CONTACTS_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="bg-navy-950/[0.015]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <h2 className="font-display text-xl text-navy-950 lg:flex-1">
          Contacts <span className="font-sans text-sm text-navy-700/55">({data.contacts.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadSample} className={secondaryButton}>
            <Download size={15} /> Sample CSV
          </button>
          <button type="button" onClick={() => setImporting(true)} className={secondaryButton}>
            <Upload size={15} /> Import CSV
          </button>
          <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
            <Plus size={15} /> Add contact
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <SearchInput value={query} onChange={(v) => { setQuery(v); setLimit(PAGE_SIZE); }} placeholder="Search name, email, company..." />
        <select aria-label="Filter by event" value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputClasses}>
          <option value="all">All events</option>
          <option value="none">No event</option>
          {data.events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by list" value={listId} onChange={(e) => setListId(e.target.value)} className={inputClasses}>
          <option value="all">All lists</option>
          {data.lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={inputClasses}>
          <option value="all">All roles</option>
          <option value="none">No role</option>
          {CONTACT_ROLES.map((r) => (
            <option key={r.role} value={r.role}>
              {r.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by subscription" value={subscription} onChange={(e) => setSubscription(e.target.value as typeof subscription)} className={inputClasses}>
          <option value="all">Subscribed + unsubscribed</option>
          <option value="subscribed">Subscribed only</option>
          <option value="unsubscribed">Unsubscribed only</option>
        </select>
      </div>

      <ErrorText>{error}</ErrorText>

      {shown.length === 0 ? (
        <EmptyState title={data.contacts.length ? "No contacts match" : "No contacts yet"}>
          {data.contacts.length ? "Try a different search or filter." : "Add one, or import a CSV."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-navy-950/[0.07] bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-navy-950/[0.025] text-xs text-navy-700/60">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Roles</th>
                <th className="px-4 py-2.5 font-medium">Events</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((c) => (
                <tr key={c.id} className="border-t border-navy-950/5 align-top">
                  <td className="px-4 py-3">
                    <p className="text-navy-950">{contactDisplayName(c)}</p>
                    <p className="text-xs text-navy-700/60">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-navy-700/80">
                    {c.company || "—"}
                    {c.phone ? <p className="text-xs text-navy-700/50">{c.phone}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <RoleTags roles={c.roles} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {c.eventIds.length === 0 ? <span className="text-navy-700/40">—</span> : null}
                      {c.eventIds.map((id) => (
                        <span key={id} className="rounded-md bg-gold-100/70 px-1.5 py-0.5 text-xs text-navy-950">
                          {eventName.get(id) ?? "Unknown event"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", c.subscribed ? "bg-emerald-50 text-emerald-700" : "bg-navy-950/[0.06] text-navy-700/70")}>
                      {c.subscribed ? "Subscribed" : "Unsubscribed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(c)} aria-label={`Edit ${contactDisplayName(c)}`} className="rounded-lg p-1.5 text-navy-700/55 hover:bg-navy-950/5 hover:text-navy-950">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => remove(c)} aria-label={`Delete ${contactDisplayName(c)}`} className="rounded-lg p-1.5 text-navy-700/55 hover:bg-red-50 hover:text-red-700">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > limit ? (
            <div className="border-t border-navy-950/5 p-3 text-center">
              <button type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)} className={secondaryButton}>
                Show more ({shown.length - limit} left)
              </button>
            </div>
          ) : null}
        </div>
      )}

      {editing ? <ContactForm contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {importing ? <CsvImportDialog onClose={() => setImporting(false)} /> : null}
    </Card>
  );
}

function ContactForm({ contact, onClose }: { contact: MailerContact | null; onClose: () => void }) {
  const { data, run } = useMailer();
  const [form, setForm] = useState<MailerContactInput>(() =>
    contact
      ? {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          company: contact.company,
          phone: contact.phone,
          eventIds: contact.eventIds,
          roles: contact.roles,
          dateOfBirth: contact.dateOfBirth ?? "",
          joiningDate: contact.joiningDate ?? "",
          subscribed: contact.subscribed,
        }
      : { firstName: "", lastName: "", email: "", company: "", phone: "", eventIds: [], roles: [], dateOfBirth: "", joiningDate: "", subscribed: true },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MailerContactInput>(k: K, v: MailerContactInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Live hints, so problems show before Save; the repository checks again.
  const email = normalizeEmail(form.email);
  const emailProblem = !email
    ? null
    : !isValidEmail(email)
      ? "That doesn't look like a valid email address."
      : data.contacts.some((c) => c.email === email && c.id !== contact?.id)
        ? "Another contact already uses this email."
        : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await run((repo) => repo.saveContact(form, contact?.id));
    setSaving(false);
    if (result.ok) onClose();
    else setError(result.error);
  }

  const toggleEvent = (id: string) => set("eventIds", form.eventIds.includes(id) ? form.eventIds.filter((x) => x !== id) : [...form.eventIds, id]);
  const toggleRole = (r: ContactRole) => set("roles", form.roles.includes(r) ? form.roles.filter((x) => x !== r) : [...form.roles, r]);

  return (
    <Modal title={contact ? "Edit contact" : "Add contact"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="First name" htmlFor="f-first">
          <input id="f-first" className={inputClasses} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="f-last">
          <input id="f-last" className={inputClasses} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label="Email" hint="(required)" htmlFor="f-email" className="sm:col-span-2">
          <input
            id="f-email"
            type="email"
            className={cn(inputClasses, emailProblem && "border-red-300")}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={emailProblem ? true : undefined}
          />
          {emailProblem ? <p className="mt-1 text-xs text-red-600">{emailProblem}</p> : null}
        </Field>
        <Field label="Company" htmlFor="f-company">
          <input id="f-company" className={inputClasses} value={form.company} onChange={(e) => set("company", e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="f-phone">
          <input id="f-phone" className={inputClasses} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Date of birth" hint="(for birthday emails)" htmlFor="f-dob">
          <input id="f-dob" type="date" className={inputClasses} value={form.dateOfBirth ?? ""} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </Field>
        <Field label="Joining date" hint="(for work anniversaries)" htmlFor="f-doj">
          <input id="f-doj" type="date" className={inputClasses} value={form.joiningDate ?? ""} onChange={(e) => set("joiningDate", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-navy-700/75">
            Roles <span className="font-normal text-navy-700/50">(pick one or more)</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CONTACT_ROLES.map((r) => {
              const on = form.roles.includes(r.role);
              return (
                <button
                  key={r.role}
                  type="button"
                  aria-pressed={on}
                  title={r.description}
                  onClick={() => toggleRole(r.role)}
                  className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-gold-500 bg-gold-100 text-navy-950" : "border-navy-950/12 text-navy-700/75")}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-navy-700/75">Events</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {data.events.map((ev) => {
              const on = form.eventIds.includes(ev.id);
              return (
                <button
                  key={ev.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleEvent(ev.id)}
                  className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-gold-500 bg-gold-100 text-navy-950" : "border-navy-950/12 text-navy-700/75")}
                >
                  {ev.name}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-950 sm:col-span-2">
          <input type="checkbox" checked={form.subscribed} onChange={(e) => set("subscribed", e.target.checked)} className="h-4 w-4 accent-[var(--color-gold-500)]" />
          Subscribed (unsubscribed contacts are never emailed)
        </label>
        <div className="sm:col-span-2">
          <ErrorText>{error}</ErrorText>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={saving || Boolean(emailProblem) || !email} className={primaryButton}>
            {contact ? "Save changes" : "Add contact"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
