import Link from "next/link";
import { CheckCircle2, ShieldCheck, TrendingUp, Users } from "lucide-react";

import { SiteShell } from "@/components/layout/site-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { listCategoryTree } from "@/services/marketplace-categories";

export const dynamic = "force-dynamic";

const BENEFITS = [
  {
    icon: Users,
    title: "Reach hosts actively planning",
    description: "Every visitor browsing Discover is already planning a real event — not a cold lead.",
  },
  {
    icon: TrendingUp,
    title: "Your own dashboard",
    description: "Manage your profile, gallery, services and pricing, and every lead — all in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Verification badge",
    description: "Get verified by our team to stand out and build trust with prospective clients.",
  },
];

const HOW_IT_WORKS = [
  "Create your free vendor account.",
  "Build your listing — photos, services, pricing, and a short description of your work.",
  "Submit it for review — our team checks every listing before it goes live.",
  "Once approved, you're discoverable across every relevant category and city page.",
  "Hosts message you directly through your listing — leads land right in your dashboard.",
];

/**
 * "Join Platform" hub — generic and data-driven rather than a
 * hardcoded page per category ("Become a Photographer", "Become a
 * Venue Partner", ...), per the module spec's own "Everything should
 * be modular" / "reusable components" principles. Every category links
 * out to the same signup flow; the onboarding content itself doesn't
 * need to differ by category since pricing/commission/verification
 * work identically for every vendor type today.
 */
export default async function BusinessHubPage() {
  const categories = await listCategoryTree();

  return (
    <SiteShell honoreeName="Celebration Memories" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <div className="bg-navy-950 pb-20 pt-32 text-ivory-50 sm:pt-40">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-xs uppercase tracking-[0.35em] text-gold-300">Become a Partner</p>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl">List Your Business on Discover</h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ivory-100/75">
            Photographers, venues, decorators, entertainers — get discovered by hosts planning their next
            celebration on Celebration Memories.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/business/signup">Create Free Vendor Account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-gold-400/60 text-gold-200 hover:bg-gold-400/10">
              <Link href="/business/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-ivory-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Why List Here" title="Built for Event Vendors" description="" />
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {BENEFITS.map((b) => (
              <Reveal key={b.title}>
                <div className="h-full rounded-2xl border border-navy-950/10 bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/10 text-gold-600">
                    <b.icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-lg text-navy-950">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy-700/75">{b.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionHeading eyebrow="How It Works" title="From Signup to Your First Lead" description="" />
          <div className="mt-8 grid gap-3">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step}>
                <div className="flex items-start gap-3 rounded-xl border border-navy-950/10 bg-ivory-50 p-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-xs font-semibold text-gold-700">
                    {i + 1}
                  </span>
                  <p className="text-sm text-navy-700/80">{step}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-gold-500/20 bg-gold-500/5 p-6">
            <h3 className="font-display text-lg text-navy-950">Pricing & Commission</h3>
            <p className="mt-2 flex items-start gap-2 text-sm text-navy-700/80">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gold-600" />
              Free to list. No commission on leads or bookings — you're contacted directly by hosts, and how you
              price and close the work is entirely between you and them.
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm text-navy-700/80">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gold-600" />
              Verification is a quick review of your listing details by our team — no documents to upload for now.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-ivory-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Categories" title="Every Kind of Vendor Welcome" description="" />
          <div className="mt-8 flex flex-wrap gap-2">
            {categories.map((top) => (
              <span key={top.id} className="rounded-full border border-navy-950/10 bg-white px-3.5 py-1.5 text-sm text-navy-700/80">
                {top.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-navy-950 py-16 text-center text-ivory-50 sm:py-20">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl">Ready to get discovered?</h2>
            <Button size="lg" className="mt-7" asChild>
              <Link href="/business/signup">Create Free Vendor Account</Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </SiteShell>
  );
}
