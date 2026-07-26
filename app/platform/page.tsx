import { redirect } from "next/navigation";

/**
 * The platform's marketing content now lives at the site root (see
 * app/page.tsx) — this route just keeps old /platform links/bookmarks
 * working via a redirect rather than a dead 404.
 */
export default function PlatformRedirectPage() {
  redirect("/");
}
