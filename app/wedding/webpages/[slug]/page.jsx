import { notFound } from "next/navigation";
import { SHOWCASE_SITES, showcaseSite } from "@/features/wedding-showcase/showcase-sites";
import ShowcaseSite from "./ShowcaseSite";

export const dynamicParams = false;
export const generateStaticParams = () => SHOWCASE_SITES.map(({ slug }) => ({ slug }));

export async function generateMetadata({ params }) {
  const site = showcaseSite((await params).slug);
  if (!site) return {};
  return {
    title: `${site.form.groom} & ${site.form.bride} — ${site.title} | Sample Wedding Website | EveryMoment`,
    description: `${site.blurb} A sample wedding website with fictional names — create your own on EveryMoment.`,
  };
}

/** One of the 20 sample wedding websites listed on /wedding/webpages. */
export default async function ShowcaseSitePage({ params }) {
  const site = showcaseSite((await params).slug);
  if (!site) notFound();
  return <ShowcaseSite site={site} />;
}
