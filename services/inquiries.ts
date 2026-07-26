import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface InquiryRecord {
  id: string;
  name: string;
  email: string;
  message: string;
  status: "new" | "read";
  createdAt: string;
}

export async function createInquiry(input: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const { error } = await supabaseAdmin().from("inquiries").insert(input);
  if (error) throw new Error(`Failed to save inquiry: ${error.message}`);
}

export async function listInquiries(): Promise<InquiryRecord[]> {
  const { data, error } = await supabaseAdmin()
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list inquiries: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function markInquiryRead(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("inquiries").update({ status: "read" }).eq("id", id);
  if (error) throw new Error(`Failed to update inquiry: ${error.message}`);
}
