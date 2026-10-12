"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAdmin, type CurrentAdmin } from "@/services/admin-auth";
import {
  createBrandLogoUpload,
  deleteHostBrand,
  parseBrandInput,
  saveHostBrand,
  setHostBrandLogo,
} from "@/services/host-brands";

type Result<T = undefined> = T extends undefined ? { success: true } | { success: false; error: string } : { success: true; data: T } | { success: false; error: string };

/**
 * A brand always belongs to the signed-in account itself (host_brands.user_id
 * = admins.id), never to an id the browser sends — so there's nothing to
 * tamper with. Client hosts (agencies) and the platform owner may brand;
 * organizers and session organizers work inside someone else's event.
 */
async function requireBrandOwner(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (admin.role !== "client" && admin.role !== "owner") throw new Error("Only the event host's account can set branding.");
  return admin;
}

function revalidateBrandPaths() {
  revalidatePath("/admin/branding");
  revalidatePath("/admin", "layout");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/invite/[token]", "page");
}

export async function saveBrandAction(input: {
  displayName: string;
  websiteUrl: string;
  applyToEvents: boolean;
}): Promise<Result> {
  try {
    const admin = await requireBrandOwner();
    const parsed = parseBrandInput(input);
    if (!parsed.ok) return { success: false, error: parsed.error };
    await saveHostBrand(admin.id, parsed.patch);
    revalidateBrandPaths();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save." };
  }
}

export async function requestBrandLogoUploadAction(
  contentType: string,
  fileSize: number,
): Promise<Result<{ path: string; signedUrl: string }>> {
  try {
    const admin = await requireBrandOwner();
    return { success: true, data: await createBrandLogoUpload(admin.id, contentType, fileSize) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function confirmBrandLogoAction(path: string | null): Promise<Result<{ logoUrl: string | null }>> {
  try {
    const admin = await requireBrandOwner();
    const logoUrl = await setHostBrandLogo(admin.id, path);
    revalidateBrandPaths();
    return { success: true, data: { logoUrl } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save the logo." };
  }
}

export async function deleteBrandAction(): Promise<Result> {
  try {
    const admin = await requireBrandOwner();
    await deleteHostBrand(admin.id);
    revalidateBrandPaths();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to remove." };
  }
}
