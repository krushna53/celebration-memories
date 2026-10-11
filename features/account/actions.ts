"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cashfreeSettings } from "@/services/cashfree-settings";
import { createCashfreeOrder } from "@/lib/cashfree";
import { EVENT_PLANS, isEventPlan, cashfreeOrderId } from "@/lib/event-plans";
import { reconcilePlanOrder, type PlanOrder } from "@/services/plan-orders";
import { SITE_URL } from "@/lib/constants";
async function buyer() {
 const { data: { user } } = await (await supabaseServer()).auth.getUser();
 if (!user || user.is_anonymous || !user.email_confirmed_at) throw new Error("Please sign in with a verified email first.");
 return user;
}
export async function startPlanCheckout(plan: string, phone: string) {
 try {
  const user = await buyer();
  if (!isEventPlan(plan)) throw new Error("Choose a valid per-event plan.");
  const normalizedPhone = phone.replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{10,15}$/.test(normalizedPhone)) throw new Error("Enter your phone number with country code.");
  const config = await cashfreeSettings();
  if (!config.appId || !config.secretKey) throw new Error("Payments are not available yet. Please contact support.");
  const db = supabaseAdmin();
  const find = () => db.from("plan_orders").select("*").eq("user_id", user.id).eq("plan", plan).eq("environment", config.environment).eq("status", "pending").maybeSingle<PlanOrder>();
  const existing = await find();
  if (existing.error) throw new Error("Could not load your checkout.");
  let order = existing.data;
  if (!order) {
   const inserted = await db.from("plan_orders").insert({user_id:user.id,plan,amount_paise:EVENT_PLANS[plan].amountPaise,environment:config.environment,customer_phone:normalizedPhone}).select("*").single<PlanOrder>();
   if (inserted.error && inserted.error.code !== "23505") throw new Error("Could not prepare checkout.");
   order = inserted.data ?? (await find()).data;
  }
  if (!order) throw new Error("Could not prepare checkout. Please try again.");
  const remote = await createCashfreeOrder({orderId:cashfreeOrderId(order.id),idempotencyKey:order.id,amount:order.amount_paise/100,currency:order.currency,customerId:user.id,customerPhone:order.customer_phone,customerEmail:user.email,
   returnUrl:`${SITE_URL}/account/billing?order=${order.id}`,notifyUrl:`${SITE_URL}/api/webhooks/cashfree`});
  if (remote.order_status !== "ACTIVE") {
   await reconcilePlanOrder(order.id,user.id);
   revalidatePath("/account/billing");
   return { error: "This checkout has finished. Refresh your billing page to see its status or start a new payment." };
  }
  return { sessionId:remote.payment_session_id,environment:config.environment };
 } catch (error) { return {error: error instanceof Error ? error.message : "Could not start checkout."}; }
}
export async function refreshPlanPayment(id: string) {
 try { const user=await buyer(); await reconcilePlanOrder(id,user.id); revalidatePath("/account/billing"); return {success:true}; }
 catch(error) { return {error:error instanceof Error ? error.message : "Could not check payment."}; }
}
export async function applyPlanPurchase(form: FormData) {
 try {
  const user=await buyer();
  const {error}=await supabaseAdmin().rpc("apply_plan_order",{oid:String(form.get("order")),eid:String(form.get("event")),buyer:user.id});
  if(error) throw new Error("Could not apply this purchase. Choose an event you own that does not already have a purchase.");
  revalidatePath("/account/billing"); revalidatePath("/admin"); return {success:true};
 } catch(error) {return {error:error instanceof Error ? error.message : "Could not apply purchase."};}
}
