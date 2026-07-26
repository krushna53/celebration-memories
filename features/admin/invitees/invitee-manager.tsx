"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildWhatsAppInviteUrl } from "@/lib/whatsapp";
import type { InviteeRecord } from "@/types/event";
import {
  bulkImportInviteesAction,
  createInviteeAction,
  deleteInviteeAction,
  updateInviteeAction,
} from "@/features/admin/invitees/actions";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const RSVP_LABEL: Record<InviteeRecord["rsvpStatus"], string> = {
  pending: "Pending",
  coming: "Coming",
  maybe: "Maybe",
  not_coming: "Declined",
};

const RSVP_COLOR: Record<InviteeRecord["rsvpStatus"], string> = {
  pending: "bg-navy-950/10 text-navy-700",
  coming: "bg-green-100 text-green-800",
  maybe: "bg-amber-100 text-amber-800",
  not_coming: "bg-red-100 text-red-700",
};

interface EmptyForm {
  name: string;
  phone: string;
  email: string;
  relationship: string;
}
const EMPTY_FORM: EmptyForm = { name: "", phone: "", email: "", relationship: "" };

interface InviteeManagerProps {
  eventId: string;
  initialInvitees: InviteeRecord[];
  hostedBy: string;
  honoreeName: string;
}

export function InviteeManager({
  eventId,
  initialInvitees,
  hostedBy,
  honoreeName,
}: InviteeManagerProps) {
  const [invitees, setInvitees] = useState(initialInvitees);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<EmptyForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EmptyForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitees;
    return invitees.filter(
      (inv) =>
        inv.name.toLowerCase().includes(q) ||
        inv.phone?.toLowerCase().includes(q) ||
        inv.email?.toLowerCase().includes(q),
    );
  }, [invitees, search]);

  async function handleCreate() {
    setBusy(true);
    const result = await createInviteeAction(eventId, createForm);
    setBusy(false);
    if (result.success) {
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      window.location.reload();
    } else {
      alert(result.error);
    }
  }

  async function handleUpdate(id: string) {
    setBusy(true);
    const result = await updateInviteeAction(id, editForm);
    setBusy(false);
    if (result.success) {
      setInvitees((prev) =>
        prev.map((inv) =>
          inv.id === id
            ? {
                ...inv,
                name: editForm.name,
                phone: editForm.phone || null,
                email: editForm.email || null,
                relationship: editForm.relationship || null,
              }
            : inv,
        ),
      );
      setEditingId(null);
    } else {
      alert(result.error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this invitee? This cannot be undone.")) return;
    setBusy(true);
    const result = await deleteInviteeAction(id);
    setBusy(false);
    if (result.success) {
      setInvitees((prev) => prev.filter((inv) => inv.id !== id));
    } else {
      alert(result.error);
    }
  }

  function copyLink(token: string, id: string) {
    navigator.clipboard.writeText(`${origin}/invite/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handleCsvFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map((row) => ({
          name: row.name ?? row.Name ?? "",
          phone: row.phone ?? row.Phone ?? "",
          email: row.email ?? row.Email ?? "",
          relationship: row.relationship ?? row.Relationship ?? "",
        }));
        setBusy(true);
        const result = await bulkImportInviteesAction(eventId, rows);
        setBusy(false);
        if (result.success) {
          setImportSummary(`Imported ${result.created} invitees (${result.skipped} skipped).`);
          window.location.reload();
        } else {
          alert(result.error);
        }
      },
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-700/40" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invitees..."
            className={cn(inputClasses, "pl-9")}
          />
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /> Import CSV
          </Button>
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus size={15} /> Add Invitee
          </Button>
        </div>
      </div>

      {importSummary ? (
        <p className="mt-2 text-xs text-navy-700/60">{importSummary}</p>
      ) : null}
      <p className="mt-1 text-xs text-navy-700/40">
        CSV columns: name, phone, email, relationship
      </p>

      {showCreate ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4 sm:grid-cols-2">
          <input
            placeholder="Full name"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="Phone (with country code)"
            value={createForm.phone}
            onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="Email (optional)"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClasses}
          />
          <input
            placeholder="Relationship (optional)"
            value={createForm.relationship}
            onChange={(e) => setCreateForm((f) => ({ ...f, relationship: e.target.value }))}
            className={inputClasses}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={handleCreate} disabled={busy || !createForm.name.trim()}>
              {busy ? <Loader2 className="animate-spin" size={15} /> : "Create Invitee"}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-navy-700/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">RSVP</th>
              <th className="px-4 py-3">Visits</th>
              <th className="px-4 py-3">Checked In</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b border-navy-950/5 last:border-0">
                {editingId === inv.id ? (
                  <td colSpan={6} className="px-4 py-3">
                    <div className="grid gap-2 sm:grid-cols-4">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputClasses}
                        placeholder="Name"
                      />
                      <input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        className={inputClasses}
                        placeholder="Phone"
                      />
                      <input
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className={inputClasses}
                        placeholder="Email"
                      />
                      <input
                        value={editForm.relationship}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, relationship: e.target.value }))
                        }
                        className={inputClasses}
                        placeholder="Relationship"
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handleUpdate(inv.id)} disabled={busy}>
                        <Check size={14} /> Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        <X size={14} /> Cancel
                      </Button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-navy-950">{inv.name}</td>
                    <td className="px-4 py-3 text-navy-700/70">
                      {inv.phone || inv.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          RSVP_COLOR[inv.rsvpStatus],
                        )}
                      >
                        {RSVP_LABEL[inv.rsvpStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy-700/70">{inv.visitCount}</td>
                    <td className="px-4 py-3">{inv.checkedIn ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Copy invite link"
                          onClick={() => copyLink(inv.token, inv.id)}
                          className="tap-target flex items-center justify-center text-navy-700/60 hover:text-gold-600"
                        >
                          {copiedId === inv.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        {inv.phone ? (
                          <a
                            title="Open WhatsApp"
                            href={buildWhatsAppInviteUrl({
                              guestName: inv.name,
                              phone: inv.phone,
                              inviteUrl: `${origin}/invite/${inv.token}`,
                              hostedBy,
                              honoreeName,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tap-target flex items-center justify-center text-navy-700/60 hover:text-green-600"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.14h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.22-8.24 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.4-.12-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.66-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.06 0 1.21.88 2.39 1 2.55.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.15-1.19-.06-.11-.23-.17-.48-.29Z" />
                            </svg>
                          </a>
                        ) : null}
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => {
                            setEditingId(inv.id);
                            setEditForm({
                              name: inv.name,
                              phone: inv.phone ?? "",
                              email: inv.email ?? "",
                              relationship: inv.relationship ?? "",
                            });
                          }}
                          className="tap-target flex items-center justify-center text-navy-700/60 hover:text-gold-600"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => handleDelete(inv.id)}
                          className="tap-target flex items-center justify-center text-navy-700/60 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-navy-700/50">No invitees found.</p>
        ) : null}
      </div>
    </div>
  );
}
