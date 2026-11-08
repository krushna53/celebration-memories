"use client";
import s from "./CreateButton.module.css";
import { useT } from "./i18n";

/** Floating button above WhatsApp. Opens the create-your-own page in a new tab. */
export default function CreateButton({ href = "/wedding-websites/create" }) {
  const t = useT();
  const label = t("createOwn");
  return <a className={s.btn} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`}>{label}</a>;
}
