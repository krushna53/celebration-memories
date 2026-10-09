"use client";
import { useActionState } from "react";
import { saveCashfreeAction } from "./cashfree-actions";
export function CashfreeForm({ appId, environment, configured }: { appId: string; environment: string; configured: boolean }) {
  const [message, action, pending] = useActionState(saveCashfreeAction, "");
  return <form action={action} className="mt-6 max-w-xl space-y-5 rounded-xl border bg-white p-6 text-navy-950">
    <p>{configured ? "Credentials saved. Secret is hidden; leave it blank to keep it." : "Enter your merchant API credentials."}</p>
    <label className="block">Environment<select name="environment" defaultValue={environment} className="mt-2 block w-full rounded border p-3"><option value="sandbox">Sandbox (testing)</option><option value="production">Production</option></select></label>
    <label className="block">App ID<input required name="appId" defaultValue={appId} maxLength={500} className="mt-2 block w-full rounded border p-3" autoComplete="off" /></label>
    <label className="block">Secret Key<input type="password" name="secret" maxLength={2000} required={!configured} className="mt-2 block w-full rounded border p-3" autoComplete="new-password" /></label>
    <button disabled={pending} className="rounded-full bg-navy-950 px-5 py-3 text-white">{pending ? "Saving…" : "Save credentials"}</button>
    <p role="status">{message}</p>
  </form>;
}
