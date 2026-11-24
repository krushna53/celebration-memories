import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, PartyPopper, Sparkles } from "lucide-react";

import { getCurrentSupabaseUser } from "@/features/auth/actions";
import { getDraftEventByToken } from "@/services/event-drafts";
import { publicMediaUrl } from "@/services/uploads";
import { Button } from "@/components/ui/button";
import { WizardStepShell } from "@/features/start/wizard-step-shell";
import { WizardBackLink } from "@/features/start/wizard-back-link";
import { draftAddWebsiteGoalAction } from "@/features/start/actions/event";
import { wizardStepHref } from "@/features/start/wizard-steps";

export const dynamic = "force-dynamic";

export default async function WizardReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await getDraftEventByToken(token);
  if (!event) notFound();

  const user = await getCurrentSupabaseUser();
  const goals = event.wizardGoals;
  const wantsWebsite = !goals || goals.includes("website");
  const wantsCard = !goals || goals.includes("invitation_card");
  const wantsSlideshow = !goals || goals.includes("slideshow");

  const publicUrl = `/start/${token}/preview/${event.templateSlug}`;
  const shareImageUrl = event.shareImagePath ? publicMediaUrl("gallery", event.shareImagePath) : null;
  const shareVideoUrl = event.shareVideoPath ? publicMediaUrl("gallery", event.shareVideoPath) : null;

  // Light, free path: nothing here was purchased or claimed, so there's
  // no account/payment gate at all — just what was actually generated,
  // ready to download, with an easy way to change their mind and build
  // the full site instead. See draftAddWebsiteGoalAction.
  if (!wantsWebsite) {
    return (
      <WizardStepShell
        token={token}
        slug="review"
        goals={event.wizardGoals}
        category={event.category}
        title="Here's what you made"
        description="No account needed for this — download anything below, or come back anytime using this same link."
        hideFooter
      >
        <div className="grid gap-6">
          <WizardBackLink token={token} slug="review" goals={event.wizardGoals} />
          {wantsCard ? (
            <section className="rounded-xl border border-navy-950/10 bg-white p-5">
              <h2 className="font-display text-lg text-navy-950">Invitation Card</h2>
              {shareImageUrl ? (
                <div className="mt-4 grid gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shareImageUrl} alt="Invitation card" className="w-full max-w-sm rounded-lg border border-navy-950/10" />
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <a href={shareImageUrl} download target="_blank" rel="noopener noreferrer">
                      <Download size={14} /> Download
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-navy-700/60">
                  You haven&rsquo;t generated one yet —{" "}
                  <Link href={wizardStepHref(token, "ai-image")} className="text-gold-600 underline underline-offset-2">
                    go make one
                  </Link>
                  .
                </p>
              )}
            </section>
          ) : null}

          {wantsSlideshow ? (
            <section className="rounded-xl border border-navy-950/10 bg-white p-5">
              <h2 className="font-display text-lg text-navy-950">Slideshow Video</h2>
              {shareVideoUrl ? (
                <div className="mt-4 grid gap-3">
                  <video src={shareVideoUrl} controls className="w-full max-w-sm rounded-lg border border-navy-950/10" />
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <a href={shareVideoUrl} download target="_blank" rel="noopener noreferrer">
                      <Download size={14} /> Download
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-navy-700/60">
                  You haven&rsquo;t rendered one yet —{" "}
                  <Link href={wizardStepHref(token, "slideshow")} className="text-gold-600 underline underline-offset-2">
                    go make one
                  </Link>
                  .
                </p>
              )}
            </section>
          ) : null}

          <section className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
                <PartyPopper size={18} />
              </div>
              <div>
                <h2 className="font-display text-lg text-navy-950">Want an event page too?</h2>
                <p className="mt-1 text-sm text-navy-700/70">
                  Add a Gallery, Timeline, RSVP, and a shareable page for guests — everything you&rsquo;ve
                  already made carries over.
                </p>
                <form action={draftAddWebsiteGoalAction.bind(null, token, event.id)} className="mt-4">
                  <Button type="submit" size="lg">
                    Continue Building
                  </Button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </WizardStepShell>
    );
  }

  return (
    <WizardStepShell
      token={token}
      slug="review"
      goals={event.wizardGoals}
      category={event.category}
      title="Review Your Event Page"
      description="Check your event page, then continue to your account and choose a plan to publish it."
      hideFooter
    >
      <div className="grid gap-6">
        <WizardBackLink token={token} slug="review" goals={event.wizardGoals} />
        <section className="rounded-xl border border-navy-950/10 bg-white p-5">
          <h2 className="font-display text-lg text-navy-950">Your Event Page</h2>
          <p className="mt-1 text-sm text-navy-700/60">
            This is the full public page, built from everything you&rsquo;ve added so far. Preview it,
            then continue below to choose a plan and publish it.
          </p>
        </section>

        {shareImageUrl ? (
          <section className="rounded-xl border border-navy-950/10 bg-white p-5">
            <h2 className="font-display text-lg text-navy-950">Invitation Card</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shareImageUrl}
              alt="Invitation card"
              className="mt-4 w-full max-w-sm rounded-lg border border-navy-950/10"
            />
          </section>
        ) : null}

        {shareVideoUrl ? (
          <section className="rounded-xl border border-navy-950/10 bg-white p-5">
            <h2 className="font-display text-lg text-navy-950">Slideshow Video</h2>
            <video src={shareVideoUrl} controls className="mt-4 w-full max-w-sm rounded-lg border border-navy-950/10" />
          </section>
        ) : null}

        <section className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-600">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="font-display text-lg text-navy-950">Ready to go live?</h2>
              <p className="mt-1 text-sm text-navy-700/70">
                Continue to your account to choose a plan and publish this event.
                Your draft and uploaded invitation card are saved.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={`/start/${token}/account`}>{user ? "Continue with My Account" : "Create Account & Continue"}</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={publicUrl} target="_blank">
                    Preview Event Page <ExternalLink size={15} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </WizardStepShell>
  );
}
