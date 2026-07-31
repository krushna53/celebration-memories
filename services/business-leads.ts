import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BusinessLead, BusinessLeadFormValues } from "@/types/marketplace";

/** A guest/event-host contacting a vendor through their listing page — modeled the same shape as services/inquiries.ts's platform-level Contact Us. */

interface LeadRow {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: BusinessLead["status"];
  source: string | null;
  created_at: string;
}

function mapLead(row: LeadRow): BusinessLead {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
  };
}

export async function createLead(businessId: string, input: BusinessLeadFormValues, source?: string): Promise<void> {
  const { error } = await supabaseAdmin().from("business_leads").insert({
    business_id: businessId,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    message: input.message,
    source: source || "listing_page",
  });
  if (error) throw new Error(`Failed to send your message: ${error.message}`);
}

export async function listLeadsForBusiness(businessId: string): Promise<BusinessLead[]> {
  const { data, error } = await supabaseAdmin()
    .from("business_leads")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load leads: ${error.message}`);
  return (data ?? []).map(mapLead);
}

export async function setLeadStatus(leadId: string, businessId: string, status: BusinessLead["status"]): Promise<void> {
  const { error } = await supabaseAdmin().from("business_leads").update({ status }).eq("id", leadId).eq("business_id", businessId);
  if (error) throw new Error(`Failed to update lead: ${error.message}`);
}
