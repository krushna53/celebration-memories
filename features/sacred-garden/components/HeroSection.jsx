"use client";
import s from "./HeroSection.module.css";
import { Icon, cx } from "./shared";
import { useT } from "./i18n";

/**
 * Full-height cover with the couple's names over a photo.
 * active: start the entrance animation (e.g. once the intro doors have opened).
 */
export default function HeroSection({ groom, bride, blessing, message = "We're getting married", dateLabel, place, image, imageAlt = "", active = true, nextId }) {
  const t = useT();
  const step = (i) => ({ transitionDelay: `${300 + i * 220}ms` });
  return <section className={cx(s.hero, active && s.active)} aria-label={`${groom} and ${bride}`}>
    {image && <img className={s.bg} src={image} alt={imageAlt} />}
    <div className={s.frame} aria-hidden="true" />
    <div className={s.content}>
      {blessing && <p className={cx(s.blessing, s.item)} style={step(0)}>{blessing}</p>}
      <p className={cx(s.message, s.item)} style={step(1)}>{message}</p>
      <div className={cx(s.rule, s.item)} style={step(1)} aria-hidden="true"><i /><Icon name="heart" size={11} /><i /></div>
      <h1 className={s.names}>
        <span className={cx(s.name, s.item)} style={step(2)}>{groom}</span>
        <span className={cx(s.amp, s.item)} style={step(3)}>&amp;</span>
        <span className={cx(s.name, s.item)} style={step(4)}>{bride}</span>
      </h1>
      {dateLabel && <p className={cx(s.date, s.item)} style={step(5)}>{dateLabel}</p>}
      {place && <p className={cx(s.place, s.item)} style={step(6)}>{place}</p>}
    </div>
    {nextId && <a className={s.scroll} href={`#${nextId}`}>{t("scroll")}<Icon name="down" size={26} strokeWidth={2.4} /></a>}
  </section>;
}
