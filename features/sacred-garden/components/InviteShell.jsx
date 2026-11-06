"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import s from "./InviteShell.module.css";
import { LangProvider, LangSwitch } from "./i18n";
import { LANGS } from "./i18n-strings";
import { useGooglePageTranslation } from "./useGooglePageTranslation";
import { cx } from "./shared";

/**
 * Wraps an invitation page and provides the brand tokens every section reads.
 * theme: optional CSS-variable overrides, e.g. { "--inv-accent": "#b8860b" }
 * locked: stops page scroll (used while the intro is showing).
 * languages: show the multilingual switch and sync its selection to ?lang=.
 */
export default function InviteShell({ theme, locked = false, languages = false, className, children }) {
  const [lang, setLang] = useState("en");
  const [languageOptions, setLanguageOptions] = useState(LANGS);
  const setLanguage = useCallback((next) => {
    setLang(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);
  useEffect(() => {
    if (!languages) return;
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("lang");
    const knownCode = LANGS.some((option) => option.id === requested);
    if (knownCode) setLang(requested);
    else if (!requested) { url.searchParams.set("lang", "en"); window.history.replaceState(window.history.state, "", url); }
    fetch("/api/translate?target=en")
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        if (!Array.isArray(result?.languages)) return;
        const known = new Map(LANGS.map((option) => [option.id, option]));
        const remote = result.languages.map(({ language, name }) => known.get(language) ?? {
          id: language, label: name || language, short: language.toUpperCase().slice(0, 3),
        });
        setLanguageOptions([...new Map([...LANGS, ...remote].map((option) => [option.id, option])).values()]);
        if (requested && !knownCode) {
          if (remote.some((option) => option.id === requested)) setLang(requested);
          else {
            setLang("en");
            const latest = new URL(window.location.href);
            latest.searchParams.set("lang", "en");
            window.history.replaceState(window.history.state, "", latest);
          }
        }
      })
      .catch(() => {});
  }, [languages]);
  const value = useMemo(() => ({ lang, setLang: setLanguage, languages: languageOptions }), [lang, setLanguage, languageOptions]);
  useGooglePageTranslation(languages ? lang : "en");
  return <LangProvider value={value}>
    <div className={cx(s.shell, locked && s.locked, className)} style={theme} lang={lang} data-invite-shell>
      {children}
      {languages && <LangSwitch />}
    </div>
  </LangProvider>;
}
