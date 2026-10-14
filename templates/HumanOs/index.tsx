import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { humanOsTheme } from "./theme";
import { HumanOsHero } from "./humanos-hero";
import type { BirthdayTemplateProps } from "@/lib/templates";

/**
 * Animations and small finishing touches for this template only, scoped
 * to .tpl-humanos so no other template is affected. All motion is
 * switched off for visitors who prefer reduced motion.
 */
const TEMPLATE_STYLE = `
.tpl-humanos .hos-blob { position: absolute; border-radius: 9999px; filter: blur(70px); opacity: 0.16; }
.tpl-humanos .hos-blob-a { width: 34rem; height: 34rem; left: -10rem; top: -8rem; }
.tpl-humanos .hos-blob-b { width: 26rem; height: 26rem; right: -6rem; top: 30%; opacity: 0.12; }
.tpl-humanos .hos-blob-c { width: 30rem; height: 30rem; left: 30%; bottom: -14rem; opacity: 0.14; }
@keyframes hos-drift-a { from { transform: translate(0, 0) scale(1); } to { transform: translate(6rem, 4rem) scale(1.12); } }
@keyframes hos-drift-b { from { transform: translate(0, 0) scale(1); } to { transform: translate(-5rem, -3rem) scale(0.9); } }
@keyframes hos-drift-c { from { transform: translate(0, 0); } to { transform: translate(-4rem, -5rem); } }
.tpl-humanos .hos-drift-a { animation: hos-drift-a 22s ease-in-out infinite alternate; }
.tpl-humanos .hos-drift-b { animation: hos-drift-b 26s ease-in-out infinite alternate; }
.tpl-humanos .hos-drift-c { animation: hos-drift-c 30s ease-in-out infinite alternate; }
@keyframes hos-spin { to { transform: rotate(360deg); } }
.tpl-humanos .hos-spin { animation: hos-spin 60s linear infinite; }
@keyframes hos-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
.tpl-humanos .hos-float { animation: hos-float 6s ease-in-out infinite; }
@keyframes hos-scroll { 0% { transform: translateY(0); opacity: 1; } 80% { transform: translateY(12px); opacity: 0; } 100% { opacity: 0; } }
.tpl-humanos .hos-scroll { animation: hos-scroll 1.8s ease-in-out infinite; }

.tpl-humanos .hos-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border-radius: 9999px; padding: 0.85rem 1.6rem; font-size: 0.95rem; font-weight: 600; transition: transform .25s ease, box-shadow .25s ease, background-color .25s ease; white-space: nowrap; }
.tpl-humanos .hos-btn:hover { transform: translateY(-2px); }
.tpl-humanos .hos-btn:focus-visible { outline: 2px solid var(--color-gold-500); outline-offset: 3px; }
.tpl-humanos .hos-btn-primary { background: var(--color-gold-500); color: #fff; box-shadow: 0 12px 24px -12px rgba(46,125,107,.7); }
.tpl-humanos .hos-btn-primary:hover { box-shadow: 0 18px 30px -12px rgba(46,125,107,.75); }
.tpl-humanos .hos-btn-whatsapp { background: #1f7a5c; color: #fff; box-shadow: 0 12px 24px -12px rgba(31,122,92,.7); }
.tpl-humanos .hos-btn-ghost { border: 1.5px solid rgba(18,41,74,.18); color: var(--color-navy-950); background: rgba(255,255,255,.7); backdrop-filter: blur(6px); }
.tpl-humanos .hos-btn-ghost:hover { border-color: var(--color-gold-500); }

@media (prefers-reduced-motion: reduce) {
  .tpl-humanos .hos-drift-a, .tpl-humanos .hos-drift-b, .tpl-humanos .hos-drift-c,
  .tpl-humanos .hos-spin, .tpl-humanos .hos-float, .tpl-humanos .hos-scroll { animation: none; }
  .tpl-humanos .hos-btn:hover { transform: none; }
}
`;

/** Private client template (see TEMPLATE_CATALOG's `access`) — same section stack as every template, with its own hero and the HumanOS palette. */
export default function HumanOs(props: BirthdayTemplateProps) {
  return (
    <TemplateThemeWrapper theme={humanOsTheme} overrides={props.event?.themeOverrides}>
      <div className="tpl-humanos">
        <style>{TEMPLATE_STYLE}</style>
        <SiteShell honoreeName={props.displayData.honoreeName} transparentUntilScroll>
          <EventSections
            event={props.event}
            displayData={props.displayData}
            galleryPhotos={props.galleryPhotos}
            milestones={props.milestones}
            renderHero={(relive, extras) => <HumanOsHero data={props.displayData} relive={relive} extras={extras} />}
          />
        </SiteShell>
      </div>
    </TemplateThemeWrapper>
  );
}
