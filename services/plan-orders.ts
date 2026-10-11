import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cashfreeSettings } from "@/services/cashfree-settings";
import { getCashfreeOrder, isCashfreeOrderPaid } from "@/lib/cashfree";
import { cashfreeOrderId } from "@/lib/event-plans";
export interface PlanOrder {
 id: string; user_id: string; plan: "celebration" | "studio"; amount_paise: number; currency: string;
 environment: "sandbox" | "production"; status: "pending" | "paid" | "expired";
 created_at: string; paid_at: string | null; event_id: string | null; access_until: string | null;
 customer_phone: string;
}
export async function reconcilePlanOrder(id: string, userId?: string) {
 let query = supabaseAdmin().from("plan_orders").select("*").eq("id", id);
 if (userId) query = query.eq("user_id", userId);
 const { data, error } = await query.maybeSingle<PlanOrder>();
 if (error || !data) throw new Error("Purchase not found.");
 if (data.status === "paid") return data.status;
 const config = await cashfreeSettings();
 if (config.environment !== data.environment) throw new Error("This purchase belongs to a different payment environment. Contact support.");
 const order = await getCashfreeOrder(cashfreeOrderId(data.id));
 if (isCashfreeOrderPaid(order, { orderId: cashfreeOrderId(data.id), amount: data.amount_paise / 100, currency: data.currency })) {
  const { error: confirmError } = await supabaseAdmin().rpc("confirm_plan_order", { oid: data.id, verified_amount: Math.round(order.order_amount * 100), verified_currency: order.order_currency, verified_environment: config.environment });
  if (confirmError) throw new Error("Payment received; confirmation is still processing. Please check again.");
  return "paid";
 }
 if (order.order_status === "PAID") throw new Error("Payment details do not match this purchase. Contact support.");
 if (["EXPIRED", "TERMINATED"].includes(order.order_status)) {
  const { error: updateError } = await supabaseAdmin().from("plan_orders").update({status:"expired"}).eq("id", id).eq("status", "pending");
  if (updateError) throw new Error("Could not update payment status.");
  return "expired";
 }
 return "pending";
}
