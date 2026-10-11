import { NextResponse } from "next/server";
import { verifyCashfreeWebhook } from "@/lib/cashfree";
import { localOrderId } from "@/lib/event-plans";
import { reconcilePlanOrder } from "@/services/plan-orders";
export const runtime = "nodejs";
export async function POST(request: Request) {
 if (Number(request.headers.get("content-length")) > 100_000) return new Response("Too large",{status:413});
 const raw=await request.text();
 if(raw.length>100_000) return new Response("Too large",{status:413});
 try {
  if(!await verifyCashfreeWebhook(raw,request.headers.get("x-webhook-timestamp"),request.headers.get("x-webhook-signature"))) return new Response("Invalid signature",{status:401});
  let payload;
  try {payload=JSON.parse(raw);} catch {return new Response("Invalid JSON",{status:400});}
  const id=typeof payload?.data?.order?.order_id === "string" ? localOrderId(payload.data.order.order_id) : null;
  if(!id) return NextResponse.json({received:true});
  // A fresh provider lookup is authoritative for success, failure and retries.
  await reconcilePlanOrder(id);
  return NextResponse.json({received:true});
 } catch { return new Response("Payment verification temporarily unavailable",{status:503}); }
}
