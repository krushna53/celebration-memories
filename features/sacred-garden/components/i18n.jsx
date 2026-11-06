"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import s from "./i18n.module.css";
import { LANGS, STRINGS } from "./i18n-strings";

const LangCtx = createContext({ lang: "en", setLang: () => {}, languages: LANGS });
export const LangProvider = LangCtx.Provider;

export function useLang() {
  return useContext(LangCtx);
}

/** Returns t("key") in the current language (English when no provider is present). */
export function useT() {
  const { lang } = useContext(LangCtx);
  return (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

/** Compact globe button; tapping it opens the language list above it. */
export function LangSwitch() {
  const { lang, setLang, languages = LANGS } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const current = languages.find((l) => l.id === lang) ?? LANGS.find((l) => l.id === lang) ?? LANGS[0];
  return <div ref={ref} className={s.wrap} data-no-translate>
    <div className={`${s.menu} ${open ? s.open : ""}`} role="menu" aria-label="Language">
      {languages.map((l) => <button key={l.id} type="button" role="menuitemradio" aria-checked={lang === l.id} tabIndex={open ? 0 : -1}
        className={`${s.item} ${lang === l.id ? s.on : ""}`} onClick={() => { setLang(l.id); setOpen(false); }}>{l.label}</button>)}
    </div>
    <button type="button" className={s.toggle} aria-haspopup="menu" aria-expanded={open} aria-label={`Language: ${current.label}`} onClick={() => setOpen((o) => !o)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
      </svg>
      <span>{current.short}</span>
    </button>
  </div>;
}
