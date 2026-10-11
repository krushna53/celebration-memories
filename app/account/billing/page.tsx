import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SiteShell } from "@/components/layout/site-shell";
import { AccountSignIn } from "@/features/account/account-sign-in";
import { CheckoutForm, PurchaseControls } from "@/features/account/billing-controls";
import { EVENT_PLANS, isEventPlan } from "@/lib/event-plans";
import { reconcilePlanOrder, type PlanOrder } from "@/services/plan-orders";
export const dynamic="force-dynamic";
export const metadata={title:"My account & billing | EveryMoment",robots:{index:false,follow:false}};
export default async function AccountBillingPage({searchParams}:{searchParams:Promise<{plan?:string;order?:string}>}) {
 const params=await searchParams; const plan=params.plan&&isEventPlan(params.plan)?params.plan:null;
 const client=await supabaseServer();const {data:{user}}=await client.auth.getUser();
 const authenticated=user&&!user.is_anonymous&&user.email_confirmed_at;
 let message="";
 if(authenticated&&params.order&&/^[0-9a-f-]{36}$/.test(params.order)) {
  try{const status=await reconcilePlanOrder(params.order,user.id);message=status==="paid"?"Payment confirmed. Your purchase is ready below.":status==="expired"?"This checkout expired. You can start a new payment.":"Payment is not confirmed yet. Check its status below before paying again.";}catch{message="We could not confirm that payment yet. Use Check payment status below, or contact support with your order reference.";}
 }
 const orders=authenticated?await client.from("plan_orders").select("*").order("created_at",{ascending:false}).limit(100):null;
 const events=authenticated?await supabaseAdmin().from("events").select("id,honoree_name,slug").eq("owner_user_id",user.id):null;
 if(orders?.error||events?.error)throw new Error("Could not load your billing account. Please try again.");
 const purchases=(orders?.data??[]) as PlanOrder[];
 const ownedEvents=events?.data??[];
 const availableEvents=ownedEvents.filter(e=>!purchases.some(p=>p.event_id===e.id));
 return <SiteShell honoreeName="EveryMoment" showLogin navLinks={[{href:"/",label:"Home"},{href:"/pricing",label:"Pricing"},{href:"/account/billing",label:"My account"},{href:"/contact",label:"Contact"}]}><div className="mx-auto max-w-4xl space-y-7 px-4 pb-24 pt-28 text-navy-950"><h1 className="font-display text-3xl">My account & billing</h1>
 {!authenticated?<AccountSignIn next={`/account/billing${plan?`?plan=${plan}`:""}`}/>:<>
 <div className="flex flex-wrap items-center gap-4"><p>{user.email}</p><Link href="/pricing" className="underline">View plans</Link>{ownedEvents.length>0&&<Link href="/admin" className="underline">Event dashboard</Link>}<Link href="/start" className="underline">Build your event</Link></div>
 {message&&<p role="status" className="rounded-lg border bg-white p-4">{message}</p>}
 {plan&&<CheckoutForm plan={plan}/>}
 <section className="space-y-4"><h2 className="font-display text-2xl">My purchases</h2>{!purchases.length&&<p>No purchases yet. Choose a per-event plan on the <Link href="/pricing" className="underline">pricing page</Link>.</p>}
 {purchases.map(order=><article key={order.id} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{EVENT_PLANS[order.plan].name} · One event</h3><p>₹{(order.amount_paise/100).toLocaleString("en-IN")} · {order.status==="paid"?"Paid":order.status==="expired"?"Expired":"Awaiting payment"}</p></div><p className="mt-2 break-all text-xs">Order reference: {order.id}</p><p className="mt-1 text-sm">{new Date(order.created_at).toLocaleDateString("en-IN")}{order.environment==="sandbox"?" · Test purchase (no live entitlement)":""}</p>
 {order.event_id&&<p className="mt-2 text-sm">Applied to {ownedEvents.find(e=>e.id===order.event_id)?.honoree_name??"your event"}. Access until {new Date(order.access_until!).toLocaleDateString("en-IN")}.</p>}
 {order.status!=="expired"&&<PurchaseControls id={order.id} paid={order.status==="paid"} canApply={order.status==="paid"&&!order.event_id&&order.environment==="production"} events={availableEvents}/>}
 {order.status!=="paid"&&<Link href={`/account/billing?plan=${order.plan}`} className="mt-3 inline-block underline">{order.status==="expired"?"Start a new payment":"Continue checkout"}</Link>}
 </article>)}</section><p className="text-sm">Monthly auto-renewal and USD checkout are not enabled yet. <Link href="/contact" className="underline">Contact support</Link> for refunds or billing help.</p></>}
 </div></SiteShell>;
}
