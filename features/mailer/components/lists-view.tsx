"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";

import type { MailerList } from "@/types/mailer";
import { contactDisplayName } from "@/lib/mailer/email";
import { useMailer } from "@/features/mailer/mailer-provider";
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
  timeAgo,
} from "@/features/mailer/components/ui";

export function ListsView() {
  const { data, run } = useMailer();
  const [editing, setEditing] = useState<MailerList | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscribed = new Set(data.contacts.filter((c) => c.subscribed).map((c) => c.id));

  async function remove(list: MailerList) {
    if (!confirm(`Delete the list "${list.name}"? Its contacts are kept.`)) return;
    const result = await run((repo) => repo.deleteList(list.id));
    setError(result.ok ? null : result.error);
  }

  return (
    <Card className="bg-navy-950/[0.015]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-navy-950">Lists</h2>
        <button type="button" onClick={() => setEditing("new")} className={primaryButton}>
          <Plus size={15} /> New list
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
      {data.lists.length === 0 ? (
        <EmptyState title="No lists yet">Group contacts into lists to send to them together.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.lists.map((l) => (
            <div key={l.id} className="flex flex-col rounded-2xl border border-navy-950/[0.07] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
                  <Users size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-950">{l.name}</p>
                  <p className="text-xs text-navy-700/55">Updated {timeAgo(l.updatedAt)}</p>
                </div>
              </div>
              {l.description ? <p className="mt-3 text-sm text-navy-700/70">{l.description}</p> : null}
              <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                <p className="text-sm text-navy-700/75">
                  <span className="text-lg font-semibold text-navy-950">{l.contactIds.length}</span> contacts
                  <span className="ml-1 text-xs text-navy-700/50">({l.contactIds.filter((id) => subscribed.has(id)).length} subscribed)</span>
                </p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setEditing(l)} aria-label={`Edit ${l.name}`} className="rounded-lg p-1.5 text-navy-700/55 hover:bg-navy-950/5 hover:text-navy-950">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => remove(l)} aria-label={`Delete ${l.name}`} className="rounded-lg p-1.5 text-navy-700/55 hover:bg-red-50 hover:text-red-700">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing ? <ListForm list={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function ListForm({ list, onClose }: { list: MailerList | null; onClose: () => void }) {
  const { data, run } = useMailer();
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [picked, setPicked] = useState(() => new Set(list?.contactIds ?? []));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = data.contacts.filter(
    (c) => !q || contactDisplayName(c).toLowerCase().includes(q) || c.email.includes(q) || c.company.toLowerCase().includes(q),
  );
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run((repo) => repo.saveList({ name, description, contactIds: [...picked] }, list?.id));
    if (result.ok) onClose();
    else setError(result.error);
  }

  return (
    <Modal title={list ? "Edit list" : "New list"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="l-name">
          <input id="l-name" className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" hint="(optional)" htmlFor="l-desc">
          <input id="l-desc" className={inputClasses} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-navy-700/75">Contacts ({picked.size} selected)</p>
            <button
              type="button"
              className="text-xs font-medium text-gold-600"
              onClick={() =>
                setPicked((prev) => {
                  const next = new Set(prev);
                  for (const c of shown) {
                    if (allShownPicked) next.delete(c.id);
                    else next.add(c.id);
                  }
                  return next;
                })
              }
            >
              {allShownPicked ? "Clear shown" : "Select all shown"}
            </button>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search contacts..." className="mt-1.5" />
          <div className="mt-2 max-h-64 divide-y divide-navy-950/5 overflow-y-auto rounded-xl border border-navy-950/10">
            {shown.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-navy-950/[0.02]">
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--color-gold-500)]" />
                <span className="min-w-0 flex-1 truncate">
                  {contactDisplayName(c)} <span className="text-xs text-navy-700/55">{c.email}</span>
                </span>
              </label>
            ))}
            {shown.length === 0 ? <p className="px-3 py-6 text-center text-sm text-navy-700/60">No contacts match.</p> : null}
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            {list ? "Save list" : "Create list"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
