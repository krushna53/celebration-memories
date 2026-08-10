import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { getPlatformVideoSettings } from "@/services/platform-video-settings";
import { PlatformVideoForm } from "@/features/admin/platform-video/platform-video-form";

export const dynamic = "force-dynamic";

export default async function AdminPlatformVideoPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const settings = await getPlatformVideoSettings();

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Feature Video</h1>
      <p className="mt-1 max-w-2xl text-sm text-navy-700/60">
        Show a short walkthrough or promo video in a &ldquo;See It In Action&rdquo; section on the public homepage,
        right below the hero. Paste a YouTube/Vimeo link, or upload a video file directly — changes go live
        immediately, no deploy needed.
      </p>

      <div className="mt-6">
        <PlatformVideoForm settings={settings} />
      </div>
    </div>
  );
}
