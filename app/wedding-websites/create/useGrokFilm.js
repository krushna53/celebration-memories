"use client";
import { useEffect, useRef, useState } from "react";
import { ENVELOPE_VIDEO } from "@/features/sacred-garden/lib/sacred-garden";
import { LIGHT_BURST_SEAL } from "@/features/sacred-garden/lib/envelope-seal-track";
import { bakeSealFilm } from "@/features/sacred-garden/lib/seal-film";
import { sealCloseUp } from "@/features/sacred-garden/components/garden/SgEnvelope";

const SAVED_CODE = "everymoment-ai-access-code";

/** close-up of the seal from the first frame of our envelope film, as a JPEG data URL (Grok re-letters this) */
async function filmSealCloseUp() {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = ENVELOPE_VIDEO;
  await new Promise((ok, fail) => { v.onloadeddata = ok; v.onerror = () => fail(new Error("The envelope film could not be loaded.")); });
  await new Promise((ok) => { v.onseeked = ok; v.currentTime = 0.04; });
  return sealCloseUp(v, LIGHT_BURST_SEAL).toDataURL("image/jpeg", 0.92);
}

/**
 * The couple's letters go on our envelope film by itself, about two seconds after they change: Grok re-letters a
 * close-up of the seal, then this browser changes only the letters inside the seal in every frame of our film and
 * saves the film on the server. The server reuses it for the same letters, so each set is paid for once.
 * letters: what the seal should show ("K & M"). filmLetters: what the current film shows.
 * onFilm(film, letters) receives the finished film's path. On a public site the owner's code is asked once.
 */
export default function useGrokFilm(letters, filmLetters, onFilm) {
  const [config, setConfig] = useState(null);
  const [code, setCode] = useState("");
  const [askCode, setAskCode] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const running = useRef(false);
  const failed = useRef(new Set());
  const latest = useRef(letters);
  latest.current = letters;

  useEffect(() => {
    let alive = true;
    fetch("/api/envelope-video/config").then((r) => r.json()).then((v) => alive && setConfig(v)).catch(() => alive && setConfig({ ready: false }));
    try { setCode(localStorage.getItem(SAVED_CODE) || ""); } catch { /* not kept */ }
    return () => { alive = false; };
  }, []);

  const api = async (action, body, query = "") => {
    const binary = body instanceof Uint8Array;
    const r = await fetch(`/api/envelope-video/${action}${query}`, { method: "POST", headers: { "content-type": binary ? "video/mp4" : "application/json", "x-ai-access-code": code }, body: binary ? body : JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 403 && config?.accessRequired) { setAskCode(true); throw new Error("Enter the owner code so Grok can update the envelope film."); }
    if (!r.ok && r.status !== 202) throw new Error(data.error || "Grok could not update the envelope film.");
    return data;
  };

  const run = async (want) => {
    running.current = true; setError(""); setStatus(`Grok is writing ${want} on the seal…`);
    try {
      let job = await api("quote", { letters: want });
      if (job.state !== "done") {
        const { token } = job;
        const seal = await api("seal", { token, confirmed: true, image: await filmSealCloseUp() });
        if (seal.state !== "done" || !seal.image) throw new Error(seal.error || "Grok did not return a seal. Check xAI usage before trying again.");
        const step = (k) => setStatus(`Putting ${want} into the envelope film… ${Math.round(k * 100)}%`);
        step(0);
        job = await api("film", await bakeSealFilm(ENVELOPE_VIDEO, seal.image, LIGHT_BURST_SEAL, step), `?token=${encodeURIComponent(token)}`);
      }
      if (job.state === "done" && job.film) {
        try { if (code) localStorage.setItem(SAVED_CODE, code); } catch { /* not kept */ }
        setAskCode(false);
        if (latest.current === want) onFilm(job.film, want);
      } else { failed.current.add(want); setError(job.error || "Grok did not finish the envelope film. Check xAI usage before trying again."); }
    } catch (e) { failed.current.add(want); setError(e.message); } finally { running.current = false; setStatus(""); setTick((t) => t + 1); }
  };

  useEffect(() => {
    if (!config?.ready || filmLetters === letters || running.current || failed.current.has(letters)) return undefined;
    if (config.accessRequired && code.length < 16) { setAskCode(true); return undefined; }
    const timer = setTimeout(() => run(letters), 2000);
    return () => clearTimeout(timer);
  }, [letters, filmLetters, config, code, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // a new code gets a fresh try at letters that failed with the old one
  useEffect(() => { failed.current.clear(); setError(""); setTick((t) => t + 1); }, [code]);

  const retry = () => { failed.current.delete(letters); setError(""); setTick((t) => t + 1); };
  return { status, error, askCode, code, setCode, retry };
}
