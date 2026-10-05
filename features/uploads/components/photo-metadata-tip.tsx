import { Info } from "lucide-react";

/**
 * Which photo sources keep the date/place we use to pre-fill Timeline
 * milestones and Gallery captions — see lib/photo-metadata.ts for the
 * details behind each line. `pickHint` says how to reach the file picker
 * on the page it's shown on.
 */
export function PhotoMetadataTip({ pickHint, className = "mt-3" }: { pickHint: string; className?: string }) {
  return (
    <details className={`${className} rounded-lg border border-navy-950/10 bg-white px-3 py-2 text-xs text-navy-700/70`}>
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-navy-950">
        <Info size={13} className="text-gold-600" /> Want the date and place filled in automatically?
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <strong>Best: the Google Drive button, or your Files app.</strong> Original photos there keep both the
          date and the location they were taken. On a phone you can also {pickHint}.
        </li>
        <li>
          <strong>Google Photos</strong> (the Google Photos button) keeps the date, but Google doesn&rsquo;t share the
          location with other apps.
        </li>
        <li>
          <strong>Your phone&rsquo;s gallery</strong> usually keeps the date. Android hides the location for privacy;
          on iPhone it&rsquo;s kept unless location sharing is switched off.
        </li>
        <li>
          <strong>WhatsApp, Facebook or Instagram copies, screenshots and scans</strong> lose both — type the details
          in instead. Scanned old prints only know the day they were scanned.
        </li>
      </ul>
    </details>
  );
}
