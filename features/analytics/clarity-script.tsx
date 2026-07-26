import Script from "next/script";

/**
 * Loads Microsoft Clarity (heatmaps + session recordings) site-wide,
 * only when NEXT_PUBLIC_CLARITY_PROJECT_ID is set — so the platform
 * works identically with it left unconfigured. Get a project ID free at
 * clarity.microsoft.com, no credit card needed.
 *
 * Note on privacy: Clarity masks input fields by default and doesn't
 * collect the RSVP/guestbook data guests type in (that's handled by
 * this app's own consent checkbox — see types/rsvp.ts). It's loaded
 * unconditionally here, the same way most sites load Google
 * Analytics-style scripts; if you have EU visitors and want a stricter
 * cookie-consent gate in front of it, that's a separate addition.
 */
export function ClarityScript() {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (!projectId) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${projectId}");`}
    </Script>
  );
}
