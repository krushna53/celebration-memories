"use client";
import s from "./DemoBar.module.css";
import { useT } from "./i18n";

/** Small floating brand pill shown on demo pages. Leave it out on a real couple's site. */
export default function DemoBar({ brandName = "EveryMoment", logo = "/everymoment-icon.svg", homeHref = "/", label, ctaHref = "/wedding-websites" }) {
  const t = useT();
  return <div className={s.bar}>
    <a className={s.brand} href={homeHref}>{logo && <img src={logo} alt="" />}<b>{brandName}</b></a>
    <span className={s.label}>{label ?? t("sampleLabel")}</span>
    <a className={s.cta} href={ctaHref}>{t("getYours")}</a>
  </div>;
}
