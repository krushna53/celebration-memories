// Small UI helpers the AI wedding video studio needs (ported from the Krushna 53 invitation studio).

/** Save a Blob as a file through a temporary link. */
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Couple details remembered from the reel page in this browser (names, date, venue), or null. */
export const DRAFT_KEY = "everymoment-ai-video-draft-v1";
export function readSavedDetails() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw).details ?? null) : null;
  } catch {
    return null;
  }
}

/** Pill-style single choice. */
export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
