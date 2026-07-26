import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { SubmitTemplateForm } from "@/features/templates/submit-template-form";

export const metadata = {
  title: "Submit a Template | Celebration Memories",
  description:
    "Design a template for Celebration Memories — pick a palette, a font, and a motion style. Approved templates go live with credit to you.",
};

/**
 * Public "Submit a Template" page — open to anyone, no account needed.
 * See features/templates/submit-template-form.tsx for the form itself
 * and lib/community-theme.ts for how a 3-color submission becomes a
 * full template. Owner reviews submissions at /admin/template-submissions.
 */
export default function SubmitTemplatePage() {
  return (
    <SiteShell honoreeName="Celebration Memories">
      <div className="bg-ivory-50 pb-24 pt-28 sm:pt-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Community Templates"
            title="Submit a Template"
            description="Design a look for Celebration Memories — a palette, a Google Font, and a motion style is all it takes. No code required. If it's approved, it goes live in the template picker with credit to you, including a link to your website if you'd like one."
          />
          <div className="mt-12">
            <Reveal>
              <SubmitTemplateForm />
            </Reveal>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
