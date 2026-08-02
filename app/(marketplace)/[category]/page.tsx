import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { CategoryDirectory } from "@/features/discover/category-directory";

export const dynamic = "force-dynamic";

/** SEO directory page — e.g. /photographers, /venues, /djs. See features/discover/category-directory.tsx for the shared rendering logic across all three URL depths. */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category } = await params;
  const sp = await searchParams;

  return (
    <SiteShell honoreeName="EveryMoment" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <CategoryDirectory categorySlug={category} searchParams={sp} />
    </SiteShell>
  );
}
