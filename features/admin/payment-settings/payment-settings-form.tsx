"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Save, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compression";
import {
  requestPaymentQrUploadUrlAction,
  updatePaymentSettingsAction,
} from "@/features/admin/payment-settings/actions";
import type { PaymentSettingsRecord } from "@/types/payment";

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2.5 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";
const labelClasses = "text-xs font-medium uppercase tracking-[0.15em] text-navy-700/70";

interface PaymentSettingsFormProps {
  settings: PaymentSettingsRecord;
  qrImageUrl: string | null;
}

export function PaymentSettingsForm({ settings, qrImageUrl }: PaymentSettingsFormProps) {
  const [form, setForm] = useState({
    upiId: settings.upiId ?? "",
    bankDetails: settings.bankDetails ?? "",
    instructions: settings.instructions ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleQrFile(rawFile: File) {
    setUploadingQr(true);
    setQrError(null);
    try {
      const file = await compressImage(rawFile);
      const signed = await requestPaymentQrUploadUrlAction(file.name, file.type, file.size);
      if (!signed.success) throw new Error(signed.error);

      const { bucket, path, token } = signed.data;
      const { error: uploadError } = await supabaseBrowser().storage.from(bucket).uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(uploadError.message);

      const result = await updatePaymentSettingsAction({ qrImagePath: path });
      if (!result.success) throw new Error(result.error);

      window.location.reload();
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Upload failed.");
      setUploadingQr(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await updatePaymentSettingsAction({
      upiId: form.upiId || null,
      bankDetails: form.bankDetails || null,
      instructions: form.instructions || null,
    });

    setSaving(false);
    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-8">
      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">QR Code</h2>
        <p className="text-xs leading-relaxed text-navy-700/60">
          Shown at the public <code className="rounded bg-navy-950/5 px-1 py-0.5">/pay</code> page —
          anyone visiting can scan it in their UPI app, then submit a
          confirmation below for you to verify manually.
        </p>
        <div className="flex items-center gap-4">
          {qrImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrImageUrl}
              alt="Current payment QR code"
              className="h-28 w-28 rounded-lg border border-navy-950/10 object-cover"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-navy-950/15 text-navy-700/30">
              <ImagePlus size={22} />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={qrInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleQrFile(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingQr}
              onClick={() => qrInputRef.current?.click()}
            >
              {uploadingQr ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              {qrImageUrl ? "Replace" : "Upload"}
            </Button>
          </div>
        </div>
        {qrError ? <p className="text-sm text-red-600">{qrError}</p> : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-navy-950/10 bg-white p-5">
        <h2 className="font-display text-lg text-navy-950">Payment Details</h2>
        <div>
          <label className={labelClasses}>UPI ID</label>
          <input
            className={`${inputClasses} mt-1.5`}
            placeholder="e.g. krushnawebworks@okaxis"
            value={form.upiId}
            onChange={(e) => set("upiId", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClasses}>Bank Details (optional)</label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-[80px] resize-y`}
            placeholder={"Account name\nAccount number\nIFSC\nBank & branch"}
            value={form.bankDetails}
            onChange={(e) => set("bankDetails", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClasses}>Instructions Shown to Payer (optional)</label>
          <textarea
            className={`${inputClasses} mt-1.5 min-h-[80px] resize-y`}
            placeholder="e.g. After paying, please fill in the form below with your UTR/reference number so we can confirm it."
            value={form.instructions}
            onChange={(e) => set("instructions", e.target.value)}
          />
        </div>
      </section>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={saving} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Saving...
            </>
          ) : (
            <>
              <Save size={16} /> Save Changes
            </>
          )}
        </Button>
        {saved ? <span className="text-sm text-green-700">Saved.</span> : null}
      </div>
    </form>
  );
}
