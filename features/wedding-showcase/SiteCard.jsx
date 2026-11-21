"use client";
// the fonts the samples use, for their names on the cards and in the openings
import "./showcase-fonts.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildShowcase, STYLES, PAGES, SEAL_TINTS } from "./showcase-sites";
import ShowcaseOpening, { canThumb } from "./ShowcaseOpening";
import { OpeningThumb, thumbHost } from "./OpeningThumb";
import { photoFor } from "./pages/parts";
import s from "./SiteCard.module.css";

const STAGE_W = 390; // the openings are drawn on a phone-sized stage, then scaled down to the card

const rgb = ([r, g, b] = []) => `rgb(${r}, ${g}, ${b})`;
/** [cloth / door / paper, its shade, gold] for the static drawings. */
function introColours(site) {
  if (site.colors) return [site.colors.main, site.colors.dark, site.colors.trim ?? "#c9a052"];
  const vars = site.curtain ?? site.doors;
  switch (site.style) {
    case "velvet": return site.fabric ? [rgb(site.fabric.base[1]), rgb(site.fabric.base[0]), "#e6c77e"] : ["#faf3e0", "#c0a87c", "#c9a052"];
    case "petals": return [vars?.["--inv-curtain"] ?? "#a8283a", vars?.["--inv-curtain-dark"] ?? "#5c1020", "#e6c77e"];
    case "monogram": return [vars?.["--inv-deep"] ?? "#1e1b4b", "#0f0d26", vars?.["--inv-accent-bright"] ?? "#e6c77e"];
    case "sage": return ["#a3b08f", "#5f6e52", "#d9c38a"];
    case "film": case "seal": return ["#f3e6cc", `hsl(${(352 + (SEAL_TINTS[site.tint ?? "red"] ?? 0)) % 360} 62% 32%)`, "#c9a86a"];
    default: return [site.form.colorBackground, site.form.colorDetail, site.form.colorAccent];
  }
}

/** The opening, live: drawn at phone size and scaled to the card; it plays while `play`. */
function LiveThumb({ site, c, play }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => setScale(el.clientWidth / STAGE_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return <div ref={box} className={s.live}>
    {scale > 0 && <div className={s.stage} style={{ width: STAGE_W, height: STAGE_W * 1.25, transform: `scale(${scale})` }}>
      <ShowcaseOpening site={site} c={c} thumb play={play} />
    </div>}
  </div>;
}

/** One sample on /wedding/webpages: its opening (hover plays it), what's inside, and a link to open the website. */
export default function SiteCard({ site, n, wide = false }) {
  const [hover, setHover] = useState(false);
  const c = useMemo(() => buildShowcase(site), [site]);
  const [cloth, shade, trim] = introColours(site);
  const f = site.form;
  const [pageName, pageNote] = PAGES[site.page] ?? [site.page, ""];
  return <Link href={`/wedding/webpages/${site.slug}`} className={`${s.card} ${thumbHost} ${wide ? s.wide : ""}`}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
    <div className={s.art} style={{ background: `url("${photoFor(c, 2)}") center / cover` }}>
      {/* behind the opening, a glimpse of the page: hovering opens onto it */}
      <span className={s.peek}><b>{pageName}</b>{f.groom} &amp; {f.bride}</span>
      {canThumb(site.style)
        ? <LiveThumb site={site} c={c} play={hover} />
        : site.style !== "none" && <span className={s.static}>
          <OpeningThumb style={site.style} cloth={cloth} shade={shade} trim={trim} bg={f.colorBackground} initials={`${f.groom[0]}&${f.bride[0]}`} />
          <span className={s.staticNames}><small>The wedding of</small>{f.groom} &amp; {f.bride}</span>
        </span>}
      <span className={s.num}>#{n}</span>
      <span className={s.hint}>{site.style === "none" ? "No opening" : "Hover to open"}</span>
    </div>
    <div className={s.body}>
      <p className={s.kind}>{STYLES[site.style]?.[1]}</p>
      <h3 className={s.title}>{site.title}</h3>
      <p className={s.blurb}>{site.blurb}</p>
      <p className={s.inside}><b>Inside: {pageName}</b> — {pageNote}</p>
      <span className={s.cta}>Open the website →</span>
    </div>
  </Link>;
}
