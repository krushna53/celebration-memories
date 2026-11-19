"use client";
import { useFormStatus } from "react-dom";
import { startFromShowcaseAction } from "./actions";
import s from "@/features/sacred-garden/components/CreateButton.module.css";

function Submit({ label }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={s.btn} disabled={pending} aria-busy={pending}>{pending ? "Setting it up…" : label}</button>;
}

/** Floating "Create your own" on a sample website: starts a draft with this sample's design and opens it in the editor. */
export default function UseDesignButton({ slug, label = "Create your own" }) {
  return <form action={startFromShowcaseAction}>
    <input type="hidden" name="slug" value={slug} />
    <Submit label={label} />
  </form>;
}
