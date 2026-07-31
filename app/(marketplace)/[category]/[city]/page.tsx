import { SiteShell } from "@/components/layout/site-shell";
import { PLATFORM_NAV_LINKS } from "@/features/platform/platform-marketing-content";
import { CategoryDirectory } from "@/features/discover/category-directory";

export const dynamic = "force-dynamic";

/** E.g. /photographers/mumbai. */
export default async function CategoryCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category, city } = await params;
  const sp = await searchParams;

  return (
    <SiteShell honoreeName="Celebration Memories" navLinks={PLATFORM_NAV_LINKS} showLogin>
      <CategoryDirectory categorySlug={category} citySlug={city} searchParams={sp} />
    </SiteShell>
  );
}
