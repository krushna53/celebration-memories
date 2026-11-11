"use client";
import { useEffect, useState } from "react";
import s from "./SgHashtag.module.css";

/**
 * The couple's hashtag in gold script, with an optional line before it ("Share every moment with").
 * glow: a soft light behind the letters, for over a photo or film. Tapping it copies the hashtag, so guests can paste it straight into Instagram; "Copied!" shows for a moment.
 */
export default function SgHashtag({ tag, lead, size = "md", glow = false }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  if (!tag) return null;
  const copy = () => navigator.clipboard?.writeText(tag).then(() => setCopied(true), () => {});
  return <p className={`${s.wrap} ${s[size]} ${glow ? s.glow : ""}`}>
    {lead && <span className={s.lead}>{lead}</span>}
    <button type="button" data-no-translate className={s.tag} onClick={copy} aria-label={`Copy hashtag ${tag}`}>{tag}</button>
    <span className={`${s.copied} ${copied ? s.show : ""}`} role="status" aria-live="polite">{copied ? "Copied!" : ""}</span>
  </p>;
}
