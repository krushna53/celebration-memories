import PublishedSite from "./PublishedSite";

export const metadata = {
  title: "Wedding Invitation | EveryMoment",
  description: "You're invited — open the envelope to see the wedding details.",
};

/** A published Sacred Garden wedding website, at /wedding/<slug> (the slug is read in the browser). */
export default function PublishedSitePage() {
  return <PublishedSite />;
}
