"use client";
import { useT } from "./i18n";
import InviteCard from "./InviteCard";
import HeroSection from "./HeroSection";
import WelcomeSection from "./WelcomeSection";
import SaveTheDateSection from "./SaveTheDateSection";
import CountdownSection from "./CountdownSection";
import EventsSection from "./EventsSection";
import ProgramTimelineSection from "./ProgramTimelineSection";
import VenueSection from "./VenueSection";
import GallerySection from "./GallerySection";
import MenuSection from "./MenuSection";
import DressCodeSection from "./DressCodeSection";
import GuestInfoSection from "./GuestInfoSection";
import RsvpSection from "./RsvpSection";
import ClosingSection, { BrandFooter } from "./ClosingSection";

const SAMPLE_MESSAGE = "We're getting married"; // the default banner; a custom banner is shown as typed
const GUEST_TITLE = { car: "transportTitle", bed: "stayTitle", gift: "giftTitle" };
const CONTACT_KEY = ["groomFamily", "brideFamily"];
const COLOR_KEY = { Navy: "colorNavy", Coral: "colorCoral", Ivory: "colorIvory", Gold: "colorGold", Rani: "colorRani" };

/**
 * The whole invitation as one card. `d` has the shape of lib/demo-invitation.js.
 * Headings, buttons and labels follow the language picker; the couple's own text is shown as typed.
 * classicLink: show a link to the full-page version under the card (demo only).
 */
export default function CardInvitation({ d, active = true, classicLink = false }) {
  const t = useT();
  const couple = `${d.groom} & ${d.bride}`;
  const location = [d.venue.name, d.venue.address].filter(Boolean).join(", ");
  const message = d.message === SAMPLE_MESSAGE ? t("gettingMarried") : d.message;
  const guestInfo = d.guestInfo.map((item) => (GUEST_TITLE[item.icon] ? { ...item, title: t(GUEST_TITLE[item.icon]) } : item));
  const contacts = d.closing.contacts.map((c, i) => ({ ...c, label: CONTACT_KEY[i] ? t(CONTACT_KEY[i]) : c.label }));
  const palette = d.dressCode.palette.map((c) => ({ ...c, name: COLOR_KEY[c.name] ? t(COLOR_KEY[c.name]) : c.name }));
  const brand = { name: "EveryMoment", logo: "/everymoment-icon.svg", href: "/", ctaLabel: t("ctaWebsite"), ctaHref: "/wedding-websites" };
  const caption = classicLink ? <>{t("classicLink")} <a href="/wedding-websites/demo">{t("classicLinkCta")}</a></> : undefined;

  return <InviteCard
    hero={<HeroSection groom={d.groom} bride={d.bride} blessing={d.blessing} message={message} dateLabel={d.dateLabel} place={d.place} image={d.heroImage} imageAlt={`${couple} at sunset`} active={active} nextId="welcome" />}
    footer={<BrandFooter brand={brand} />}
    caption={caption}>
    <WelcomeSection eyebrow={t("welcomeEyebrow")} title={t("welcome")} message={d.welcome.message} families={d.welcome.families} />
    <SaveTheDateSection eyebrow={t("saveDateEyebrow")} title={t("saveDate")} subtitle={t("scratch")} scratchLabel={t("scratchReveal")} date={d.date} endDate={d.endDate} eventTitle={`${couple} — Wedding`} location={location} details={`Join us to celebrate the wedding of ${couple}.`} />
    <CountdownSection eyebrow={t("countdownEyebrow")} title={t("countdown")} labels={[t("days"), t("hours"), t("minutes"), t("seconds")]} date={d.date} tone="light" />
    <EventsSection eyebrow={t("joinUs")} title={t("celebrations")} events={d.events} />
    <ProgramTimelineSection eyebrow={t("programEyebrow")} title={t("program")} items={d.program} />
    <VenueSection eyebrow={t("where")} title={t("venue")} label={t("venueLabel")} {...d.venue} />
    <GallerySection eyebrow={t("moments")} title={t("gallery")} photos={d.gallery} />
    <MenuSection eyebrow={t("menuEyebrow")} title={t("menu")} vegLabel={t("veg")} veg={d.menu.veg} />
    <DressCodeSection eyebrow={t("dressEyebrow")} title={t("dressCode")} paletteLabel={t("palette")} women={d.dressCode.women} men={d.dressCode.men} palette={palette} tone="light" />
    <GuestInfoSection eyebrow={t("guestEyebrow")} title={t("guestInfo")} items={guestInfo} />
    <RsvpSection eyebrow={t("rsvpEyebrow")} title={t("rsvp")} events={d.rsvp.events} deadline={d.rsvp.deadline} coupleNames={couple} />
    <ClosingSection thanks={t("thanks")} message={d.closing.message} names={couple.toUpperCase()} hashtag={d.closing.hashtag} contacts={contacts} tone="light" />
  </InviteCard>;
}
