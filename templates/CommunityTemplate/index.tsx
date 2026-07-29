import { SiteShell } from "@/components/layout/site-shell";
import { EventSections } from "@/features/event-landing/event-sections";
import { TemplateThemeWrapper } from "@/templates/shared/template-theme-wrapper";
import { deriveThemeFromSubmission, googleFontStylesheetUrl } from "@/lib/community-theme";
import type { TemplateSubmissionRecord } from "@/types/template-submission";
import type { BirthdayTemplateProps } from "@/lib/templates";

interface CommunityTemplateProps extends BirthdayTemplateProps {
  submission: TemplateSubmissionRecord;
}

/**
 * The single renderer for every approved community template — unlike
 * built-in templates (one folder + component per look), community
 * templates are config-only (palette + font + animation, no custom
 * code), so one generic component handles all of them, parameterized by
 * the approved TemplateSubmissionRecord. See lib/community-theme.ts for
 * how the 3 seed colors become a full palette, and
 * lib/templates.ts#resolveTemplate for where this gets wired up.
 *
 * The Google Fonts <link> below is deliberately NOT next/font — next/font
 * requires knowing every font at build time, which would mean a code
 * deploy per approved submission. A plain <link> works for any font name
 * and, rendered from a Server Component, Next.js hoists it into <head>
 * automatically.
 */
export default function CommunityTemplate({ submission, ...props }: CommunityTemplateProps) {
  const theme = deriveThemeFromSubmission(submission);

  return (
    <>
      <link rel="stylesheet" href={googleFontStylesheetUrl(submission.fontDisplay)} />
      <TemplateThemeWrapper theme={theme}>
        <SiteShell
          honoreeName={props.displayData.honoreeName}
          designerCredit={{ name: submission.authorName, website: submission.authorWebsite }}
          transparentUntilScroll
        >
          <EventSections
            event={props.event}
            displayData={props.displayData}
            galleryPhotos={props.galleryPhotos}
            milestones={props.milestones}
          />
        </SiteShell>
      </TemplateThemeWrapper>
    </>
  );
}
