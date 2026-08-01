"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Baby,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  Download,
  Loader2,
  MailCheck,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildWhatsAppInviteUrl } from "@/lib/whatsapp";
import { INVITE_CHANNEL_OPTIONS, inviteChannelLabel } from "@/lib/invite-channel";
import type { InviteeRecord } from "@/types/event";
import type { InviteeWithRsvp } from "@/services/admin-invitees";
import {
  bulkImportInviteesAction,
  createInviteeAction,
  deleteInviteeAction,
  exportRsvpCsvAction,
  markInviteSentAction,
  updateInviteeAction,
} from "@/features/admin/invitees/actions";
import { BulkSendPanel } from "@/features/admin/invitees/bulk-send-panel";

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
  inviteChannel: string;
}
const EMPTY_FORM: EmptyForm = { name: "", phone: "", email: "", relationship: "", inviteChannel: "" };

type SortKey =
  | "name"
  | "phone"
  | "email"
  | "relationship"
  | "rsvp"
  | "party"
  | "meal"
  | "comments"
  | "rsvpDate"
  | "inviteSent"
  | "visits"
  | "checkedIn";

/** Display order for RSVP-status sorting — "who's coming" first, declines last. */
const RSVP_RANK: Record<InviteeRecord["rsvpStatus"], number> = {
  coming: 0,
  maybe: 1,
  pending: 2,
  not_coming: 3,
};

/** Per-row comparable value for each sortable column. Nulls sort last on ascending. */
function sortValue(inv: InviteeWithRsvp, key: SortKey): string | number {
  switch (key) {
    case "name":
      return inv.name.toLowerCase();
    case "phone":
      return inv.phone?.toLowerCase() ?? "￿";
    case "email":
      return inv.email?.toLowerCase() ?? "￿";
    case "relationship":
      return inv.relationship?.toLowerCase() ?? "￿";
    case "rsvp":
      return RSVP_RANK[inv.rsvpStatus];
    case "party":
      return inv.rsvpDetail ? inv.rsvpDetail.adults + inv.rsvpDetail.children : -1;
    case "meal":
      return inv.rsvpDetail?.mealPreference?.toLowerCase() ?? "￿";
    case "comments":
      return inv.rsvpDetail?.comments?.toLowerCase() ?? "￿";
    case "rsvpDate":
      return inv.rsvpDetail ? new Date(inv.rsvpDetail.submittedAt).getTime() : 0;
    case "inviteSent":
      return inv.inviteSentAt ? new Date(inv.inviteSentAt).getTime() : 0;
    case "visits":
      return inv.visitCount;
    case "checkedIn":
      return inv.checkedIn ? 1 : 0;
  }
}

/** Fixed palette for the meal-preference donut — distinct hues that still sit comfortably in the site's warm luxury look. */
const MEAL_COLORS = ["#c9a227", "#2fb8ac", "#c96a8c", "#5b7ea8", "#e88f68", "#7c5cf0", "#87a066", "#b3413a"];

function mealLabel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface InviteeManagerProps {
  eventId: string;
  eventSlug: string;
  initialInvitees: InviteeWithRsvp[];
  hostedBy: string;
  honoreeName: string;
  inviteMessageTemplate: string | null;
}

export function InviteeManager({
  eventId,
  eventSlug,
  initialInvitees,
  hostedBy,
  honoreeName,
  inviteMessageTemplate,
}: InviteeManagerProps) {
  const [invitees, setInvitees] = useState(initialInvitees);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<EmptyForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EmptyForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [showBulkSend, setShowBulkSend] = useState(false);
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

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev?.key === key ? (prev.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  }

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return 0;
    });
  }, [filtered, sort]);

  /**
   * Headcount + meal breakdown across the (search-filtered) list.
   * Adults/children/meals only count guests marked "coming" — a
   * declined or still-pending guest's old party size shouldn't inflate
   * the catering numbers. Meal counts are weighted by party headcount
   * (adults + children), since that's the number a caterer actually
   * cooks for, not the number of form submissions.
   */
  const stats = useMemo(() => {
    let adults = 0;
    let children = 0;
    let responses = 0;
    const meals = new Map<string, number>();
    for (const inv of filtered) {
      if (inv.rsvpDetail) responses++;
      if (inv.rsvpStatus !== "coming" || !inv.rsvpDetail) continue;
      adults += inv.rsvpDetail.adults;
      children += inv.rsvpDetail.children;
      const meal = inv.rsvpDetail.mealPreference || "unspecified";
      meals.set(meal, (meals.get(meal) ?? 0) + inv.rsvpDetail.adults + inv.rsvpDetail.children);
    }
    const mealData = Array.from(meals.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    return { adults, children, total: adults + children, responses, mealData };
  }, [filtered]);

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
    const result = await updateInviteeAction(id, eventId, editForm);
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
                inviteChannel: editForm.inviteChannel || null,
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
    const result = await deleteInviteeAction(id, eventId);
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

  /**
   * Best-effort "sent" marker: fires after the WhatsApp tab is already
   * opening, so a failure here never blocks the guest's message. Updates
   * local state immediately for instant feedback, then persists.
   */
  function markSent(id: string) {
    setInvitees((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, inviteSentAt: new Date().toISOString() } : inv)),
    );
    markInviteSentAction(id, eventId).catch(() => {
      // Non-critical — the guest's WhatsApp tab already opened either way.
    });
  }

  async function handleExport() {
    setExporting(true);
    const result = await exportRsvpCsvAction(eventId, eventSlug);
    setExporting(false);
    if (!result.success) {
      alert(result.error);
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          <Button variant="outline" onClick={handleExport} disabled={exporting || invitees.length === 0}>
            {exporting ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />} Export CSV
          </Button>
          <Button variant="outline" onClick={() => setShowBulkSend((v) => !v)}>
            <Send size={15} /> Bulk Send
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

      {showBulkSend ? (
        <BulkSendPanel
          invitees={invitees}
          origin={origin}
          hostedBy={hostedBy}
          honoreeName={honoreeName}
          messageTemplate={inviteMessageTemplate}
          onOpen={markSent}
          onClose={() => setShowBulkSend(false)}
        />
      ) : null}

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
          <select
            value={createForm.inviteChannel}
            onChange={(e) => setCreateForm((f) => ({ ...f, inviteChannel: e.target.value }))}
            className={inputClasses}
          >
            <option value="">How was this invite sent? (optional)</option>
            {INVITE_CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto]">
        <StatCard icon={<User size={18} />} label="Adults Coming" value={stats.adults} />
        <StatCard icon={<Baby size={18} />} label="Children Coming" value={stats.children} />
        <StatCard icon={<Users size={18} />} label="Total Guests Coming" value={stats.total} />
        <StatCard icon={<MailCheck size={18} />} label="RSVPs Received" value={stats.responses} />
        <MealDonutCard data={stats.mealData} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-navy-950/10 bg-white">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="border-b border-navy-950/10 text-xs uppercase tracking-wide text-navy-700/50">
            <tr>
              <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortableTh label="Phone" sortKey="phone" sort={sort} onSort={toggleSort} />
              <SortableTh label="Email" sortKey="email" sort={sort} onSort={toggleSort} />
              <SortableTh label="Relationship" sortKey="relationship" sort={sort} onSort={toggleSort} />
              <SortableTh label="RSVP" sortKey="rsvp" sort={sort} onSort={toggleSort} />
              <SortableTh label="Party" sortKey="party" sort={sort} onSort={toggleSort} />
              <SortableTh label="Meal" sortKey="meal" sort={sort} onSort={toggleSort} />
              <SortableTh label="Comments" sortKey="comments" sort={sort} onSort={toggleSort} />
              <SortableTh label="RSVP Date" sortKey="rsvpDate" sort={sort} onSort={toggleSort} />
              <SortableTh label="Invite Sent" sortKey="inviteSent" sort={sort} onSort={toggleSort} />
              <SortableTh label="Visits" sortKey="visits" sort={sort} onSort={toggleSort} />
              <SortableTh label="Checked In" sortKey="checkedIn" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((inv) => (
              <tr key={inv.id} className="border-b border-navy-950/5 last:border-0">
                {editingId === inv.id ? (
                  <td colSpan={13} className="px-4 py-3">
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
                      <select
                        value={editForm.inviteChannel}
                        onChange={(e) => setEditForm((f) => ({ ...f, inviteChannel: e.target.value }))}
                        className={inputClasses}
                      >
                        <option value="">How was this invite sent?</option>
                        {INVITE_CHANNEL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
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
                      {inv.phone || "—"}
                      {inv.inviteChannel ? (
                        <span className="ml-1.5 rounded-full bg-navy-950/5 px-1.5 py-0.5 text-[10px] text-navy-700/60">
                          {inviteChannelLabel(inv.inviteChannel)}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-navy-700/70" title={inv.email ?? undefined}>
                      {inv.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-navy-700/70">{inv.relationship || "—"}</td>
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
                    <td className="px-4 py-3 text-navy-700/70">
                      {inv.rsvpDetail ? (
                        <span title={`${inv.rsvpDetail.adults} adult(s), ${inv.rsvpDetail.children} child(ren)`}>
                          {inv.rsvpDetail.adults + inv.rsvpDetail.children}
                          <span className="text-navy-700/40">
                            {" "}
                            ({inv.rsvpDetail.adults}A{inv.rsvpDetail.children > 0 ? ` + ${inv.rsvpDetail.children}C` : ""})
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize text-navy-700/70">
                      {inv.rsvpDetail?.mealPreference?.replace(/_/g, " ") || "—"}
                    </td>
                    <td
                      className="max-w-[200px] truncate px-4 py-3 text-navy-700/70"
                      title={inv.rsvpDetail?.comments ?? undefined}
                    >
                      {inv.rsvpDetail?.comments || "—"}
                    </td>
                    <td className="px-4 py-3 text-navy-700/70">
                      {inv.rsvpDetail ? new Date(inv.rsvpDetail.submittedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-navy-700/70">
                      {inv.inviteSentAt ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCheck size={14} />
                          {new Date(inv.inviteSentAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-navy-700/30">Not sent</span>
                      )}
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
                              messageTemplate: inviteMessageTemplate,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markSent(inv.id)}
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
                              inviteChannel: inv.inviteChannel ?? "",
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-4">
      <div className="flex items-center gap-2 text-gold-600">{icon}</div>
      <p className="mt-2 font-display text-2xl text-navy-950">{value}</p>
      <p className="text-xs text-navy-700/60">{label}</p>
    </div>
  );
}

/**
 * Dependency-free SVG donut of guests-by-meal-preference — each segment
 * is a circle stroke offset around the ring (no chart library needed
 * for a single static donut). Counts are guest headcounts among
 * "coming" RSVPs, matching the stat cards beside it.
 */
function MealDonutCard({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const R = 40;
  const C = 2 * Math.PI * R;

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const dash = (d.value / total) * C;
    const segment = { ...d, dash, offset: cumulative, color: MEAL_COLORS[i % MEAL_COLORS.length]! };
    cumulative += dash;
    return segment;
  });

  return (
    <div className="rounded-xl border border-navy-950/10 bg-white p-4 sm:col-span-2 lg:col-span-1 lg:min-w-[260px]">
      <p className="text-xs font-medium uppercase tracking-wide text-navy-700/50">Meal Preferences (guests coming)</p>
      {total === 0 ? (
        <p className="mt-3 text-sm text-navy-700/50">No meal preferences yet.</p>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0" role="img" aria-label="Meal preference breakdown">
            {segments.map((s) => (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="16"
                strokeDasharray={`${s.dash} ${C - s.dash}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 50 50)"
              />
            ))}
          </svg>
          <ul className="grid gap-1 text-xs text-navy-700/80">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                {mealLabel(s.label)} — <strong>{s.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 1 | -1 } | null;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "flex items-center gap-1 uppercase tracking-wide hover:text-navy-950",
          active ? "text-navy-950" : "text-navy-700/50",
        )}
      >
        {label}
        {active ? (
          sort.dir === 1 ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )
        ) : (
          <ChevronsUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );
}
