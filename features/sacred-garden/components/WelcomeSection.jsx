"use client";
import s from "./WelcomeSection.module.css";
import { Icon, Reveal, Section, SectionHeading } from "./shared";

/**
 * Welcome note plus the two families.
 * families: [{ role: "The Groom", name: "Aarav", parents: "Son of …" }, { … }]
 */
export default function WelcomeSection({ id = "welcome", eyebrow = "Together with our families", title = "Welcome", message, families = [], tone = "light" }) {
  return <Section id={id} tone={tone} narrow className={s.section} label="Welcome">
    <SectionHeading eyebrow={eyebrow} title={title} />
    {message && <Reveal as="p" className={s.message}>{message}</Reveal>}
    {families.length === 2 && <div className={s.families}>
      <Reveal className={s.person} delay={100}><small>{families[0].role}</small><h3>{families[0].name}</h3><p>{families[0].parents}</p></Reveal>
      <Reveal className={s.join} delay={200} aria-hidden="true"><Icon name="rings" size={26} /></Reveal>
      <Reveal className={s.person} delay={300}><small>{families[1].role}</small><h3>{families[1].name}</h3><p>{families[1].parents}</p></Reveal>
    </div>}
  </Section>;
}
