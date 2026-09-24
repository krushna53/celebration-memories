import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { resolveAdminEvent } from "@/lib/admin-event";
import { shouldRedirectSessionOrganizerAway } from "@/lib/admin-roles";
import { listGalleryPhotos } from "@/services/gallery-photos";
import { GalleryManager } from "@/features/admin/gallery/gallery-manager";
import { NoEventState } from "@/features/admin/components/no-event-state";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const admin = await getCurrentAdmin();
  if (admin && shouldRedirectSessionOrganizerAway(admin.role)) redirect("/admin/my-sessions");
  const event = admin ? await resolveAdminEvent(admin) : null;
  if (!event) {
    return <NoEventState />;
  }

  const photos = await listGalleryPhotos(event.id);

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Gallery</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        Curate the photos shown in the public Gallery section, by category.
      </p>
      <div className="mt-6">
        <GalleryManager eventId={event.id} initialPhotos={photos} />
      </div>
    </div>
  );
}
