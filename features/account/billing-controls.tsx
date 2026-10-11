"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { startPlanCheckout, refreshPlanPayment, applyPlanPurchase } from "./actions";
import { EVENT_PLANS, type EventPlan } from "@/lib/event-plans";

import { CALLING_CODES, countryFlag, checkoutPhone } from "@/lib/phone-countries";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = Object.keys(CALLING_CODES).sort((a,b) => (regionNames.of(a) ?? a).localeCompare(regionNames.of(b) ?? b));

type CashfreeWindow = Window & { Cashfree?: (options:{mode:string}) => {checkout:(options:{paymentSessionId:string;redirectTarget:string})=>Promise<{error?:{message?:string}}>}};
export function CheckoutForm({plan,initialCountry="IN"}:{plan:EventPlan;initialCountry?:string}) {
 const [country,setCountry]=useState(CALLING_CODES[initialCountry] ? initialCountry : "IN");
 const [phone,setPhone]=useState(""); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [ready,setReady]=useState(false);
 return <><Script src="https://sdk.cashfree.com/js/v3/cashfree.js" onReady={()=>setReady(true)} onError={()=>setError("Checkout could not load. Refresh or try another browser.")} />
 <form className="space-y-4 rounded-xl border bg-white p-6" onSubmit={async e=>{
  e.preventDefault();setBusy(true);setError("");
  try {
   const result=await startPlanCheckout(plan,checkoutPhone(country,phone));
   if(result.error || !result.sessionId) throw new Error(result.error || "Could not start checkout.");
   const sdk=(window as CashfreeWindow).Cashfree;
   if(!sdk) throw new Error("Checkout is still loading. Please try again.");
   const response=await sdk({mode:result.environment}).checkout({paymentSessionId:result.sessionId,redirectTarget:"_self"});
   if(response?.error) throw new Error(response.error.message || "Payment was not completed. You can retry from your purchases below.");
  } catch(err) {setError(err instanceof Error?err.message:"Could not open checkout.");} finally {setBusy(false);}
 }}>
 <h2 className="font-display text-xl">{EVENT_PLANS[plan].name} — ₹{(EVENT_PLANS[plan].amountPaise/100).toLocaleString("en-IN")}</h2>
 <p className="text-sm">1 event · 12 months · One-time payment</p>
 <div><label htmlFor="checkout-phone" className="block text-sm">Mobile number</label>
 <div className="mt-2 flex min-w-0 gap-2">
 <select aria-label="Country and calling code" autoComplete="country" value={country} onChange={e=>setCountry(e.target.value)} className="w-32 min-w-0 rounded-lg border bg-white p-3 sm:w-48">{countries.map(code=><option key={code} value={code}>{countryFlag(code)} {regionNames.of(code)} +{CALLING_CODES[code]}</option>)}</select>
 <input id="checkout-phone" required type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Mobile number" value={phone} onChange={e=>setPhone(e.target.value)} className="min-w-0 flex-1 rounded-lg border p-3" maxLength={25}/>
 </div></div>
 <p className="text-sm text-navy-700">After payment, choose the event you want to upgrade.</p>
 <button disabled={busy||!ready} className="rounded-full bg-gold-500 px-6 py-3 font-semibold disabled:opacity-50">{busy?"Opening checkout…":!ready?"Loading checkout…":`Pay ₹${(EVENT_PLANS[plan].amountPaise/100).toLocaleString("en-IN")}`}</button>
 <p className="text-xs">Secure payment via Cashfree · Charged in INR</p>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 </form></>;
}
export function PurchaseControls({id,paid,canApply,events}:{id:string;paid:boolean;canApply:boolean;events:{id:string;honoree_name:string}[]}) {
 const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function run(task:()=>Promise<{error?:string}>) {setBusy(true);setMessage("");try{const r=await task();if(r.error)setMessage(r.error);else router.refresh();}catch{setMessage("Please try again.");}finally{setBusy(false);}}
 return <div className="mt-3 space-y-3">{!paid&&<button disabled={busy} onClick={()=>run(()=>refreshPlanPayment(id))} className="rounded-lg border px-4 py-2">{busy?"Checking…":"Check payment status"}</button>}
 {canApply&&events.length>0&&<form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void run(()=>applyPlanPurchase(form));}}><input type="hidden" name="order" value={id}/><select required name="event" aria-label="Choose your event" className="min-w-0 max-w-full rounded-lg border p-2"><option value="">Choose your event</option>{events.map(event=><option key={event.id} value={event.id}>{event.honoree_name}</option>)}</select><button disabled={busy} className="rounded-lg bg-navy-950 px-4 py-2 text-white">{busy?"Applying…":"Apply to event"}</button></form>}
 {canApply&&events.length===0&&<p className="text-sm">Your purchase is ready. Create an event in the builder and link it to this account to apply your purchase here.</p>}
 {message&&<p role="status" className="text-sm text-red-700">{message}</p>}</div>;
}
