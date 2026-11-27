import "server-only";

import { getCurrentAdmin } from "@/services/admin-auth";
import type { CurrentAdmin } from "@/services/admin-auth";

/** The site owner plus explicitly configured blog editors can manage posts. */
export function canManageBlog(admin: Pick<CurrentAdmin, "email" | "role"> | null | undefined): boolean {
  if (!admin) return false;
  if (admin.role === "owner") return true;

  const configured = process.env.BLOG_ADMIN_EMAILS?.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean) ?? [];
  const allowedEmails = [...configured, process.env.ADMIN_NOTIFICATION_EMAIL?.trim().toLowerCase(), "krushnawebworks@gmail.com"].filter((email): email is string => Boolean(email));
  return allowedEmails.includes(admin.email.trim().toLowerCase());
}

export async function requireBlogAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorized.");
  if (!canManageBlog(admin)) throw new Error("Blog management is restricted to authorized editors.");
  return admin;
}
