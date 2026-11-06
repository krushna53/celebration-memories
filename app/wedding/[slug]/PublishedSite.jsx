"use client";
import { useEffect, useMemo, useState } from "react";
import { InviteShell } from "@/features/sacred-garden/components";
import { SacredGardenInvitation, SgEnvelope, gardenTheme } from "@/features/sacred-garden/components/garden";
import { formDefaults, buildInvitation, SAMPLE_SITES } from "@/features/sacred-garden/lib/invitation-form";

/** The couple's saved website: the envelope film opens onto their Sacred Garden page. English only, no language switch. */
export default function PublishedSite() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const slug = location.pathname.split("/")[2] || new URLSearchParams(location.search).get("s") || "";
    if (!slug) { setError("This website link is incomplete."); return; }
    if (SAMPLE_SITES[slug]) { setForm(SAMPLE_SITES[slug]); return; } // ready-made samples, no saved data needed
    fetch(`/api/website/${encodeURIComponent(slug)}`)
      .then((r) => r.json().then((data) => (r.ok ? data : Promise.reject(new Error(data.error || "Website not found")))))
      .then((data) => setForm({ ...formDefaults, ...data.form }))
      .catch((e) => setError(e.message === "Website not found" ? "We could not find this wedding website. Check the link." : "The website could not be loaded. Please try again."));
  }, []);

  const c = useMemo(() => (form ? buildInvitation(form) : null), [form]);
  useEffect(() => { if (c) document.title = `${c.couple.first} & ${c.couple.second} — Wedding Invitation`; }, [c]);

  if (error) return <p style={{ padding: "40vh 16px 0", textAlign: "center", fontFamily: "Georgia, serif" }}>{error}</p>;
  if (!c) return null;
  const envelope = c.envelope.ready && !opened;
  return <InviteShell locked={envelope}>
    {c.envelope.ready && <SgEnvelope video={c.envelope.video} music={c.music || undefined} tapLabel={c.envelope.tapLabel} monogram={c.monogram} sealTrack={c.envelope.sealTrack}
      sealImage={c.envelope.sealImage} theme={gardenTheme(c)} onDone={() => setOpened(true)} />}
    <SacredGardenInvitation c={c} />
  </InviteShell>;
}
