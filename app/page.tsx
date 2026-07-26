import { HeroSection } from "@/features/hero/hero-section";

/**
 * Homepage. Phase 1 ships Hero + global Navbar/Footer (mounted in the
 * root layout). Countdown, Event Details, Gallery, Timeline, RSVP, Guest
 * Memories and Location sections are added in Phase 2 onward, each as
 * its own <section id="..."> matching the anchors in NAV_LINKS.
 */
export default function Home() {
  return (
    <>
      <HeroSection />
    </>
  );
}
