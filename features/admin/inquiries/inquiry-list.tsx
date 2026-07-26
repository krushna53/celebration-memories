"use client";

import { useState } from "react";
import { Mail, MailOpen } from "lucide-react";

import { markInquiryReadAction } from "@/features/admin/inquiries/actions";
import type { InquiryRecord } from "@/services/inquiries";

export function InquiryList({ initialInquiries }: { initialInquiries: InquiryRecord[] }) {
  const [inquiries, setInquiries] = useState(initialInquiries);

  async function markRead(id: string) {
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status: "read" } : i)));
    await markInquiryReadAction(id);
  }

  if (inquiries.length === 0) {
    return <p className="text-sm text-navy-700/60">No messages yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {inquiries.map((inquiry) => (
        <div
          key={inquiry.id}
          className={`rounded-xl border p-5 ${
            inquiry.status === "new" ? "border-gold-500/40 bg-gold-500/5" : "border-navy-950/10 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-navy-950">{inquiry.name}</p>
              <a href={`mailto:${inquiry.email}`} className="text-sm text-gold-600 underline underline-offset-2">
                {inquiry.email}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-navy-700/50">
                {new Date(inquiry.createdAt).toLocaleString()}
              </span>
              {inquiry.status === "new" ? (
                <button
                  type="button"
                  onClick={() => markRead(inquiry.id)}
                  className="flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1 text-xs font-medium text-navy-950"
                >
                  <Mail size={12} /> Mark Read
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-navy-700/40">
                  <MailOpen size={12} /> Read
                </span>
              )}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-navy-700/80">{inquiry.message}</p>
        </div>
      ))}
    </div>
  );
}
