"use client";
import { useEffect, useRef, useState } from "react";
import s from "./VenueSection.module.css";
import { Button, Icon, Reveal, Section, SectionHeading } from "./shared";
import { useT } from "./i18n";

// Loads the map only when it nears the screen. The browser's own iframe lazy-loading
// does not fire inside container-query layouts like <InviteCard>, so we observe it ourselves.
function LazyMap({ title, src }) {
  const ref = useRef(null);
  const [load, setLoad] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") { setLoad(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setLoad(true); io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={s.mapWrap}>{load && <iframe className={s.map} title={title} src={src} referrerPolicy="no-referrer-when-downgrade" />}</div>;
}

/**
 * Venue card with an embedded Google Map (no API key needed).
 * mapQuery: text Google Maps can search, e.g. "The Oberoi Udaivilas, Udaipur".
 */
export default function VenueSection({ id = "venue", eyebrow = "Where", title = "The Venue", label = "Wedding venue", name, address, image, mapQuery, phone, tone = "light" }) {
  const query = encodeURIComponent(mapQuery || `${name}, ${address}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
  const t = useT();
  return <Section id={id} tone={tone} label="Venue">
    <SectionHeading eyebrow={eyebrow} title={title} />
    <Reveal className={s.layout}>
      <div className={s.info}>
        {image && <img className={s.photo} src={image} alt={name} loading="lazy" />}
        <p className={s.label}>{label}</p>
        <h3 className={s.name}>{name}</h3>
        <p className={s.address}><Icon name="pin" size={18} />{address}</p>
        <div className={s.actions}>
          <Button href={mapsUrl} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={18} />{t("viewMap")}</Button>
          {phone && <Button variant="ghost" href={`tel:${phone.replace(/\s/g, "")}`}>{t("callVenue")}</Button>}
        </div>
      </div>
      <LazyMap title={`Map to ${name}`} src={`https://maps.google.com/maps?q=${query}&z=15&output=embed`} />
    </Reveal>
  </Section>;
}
