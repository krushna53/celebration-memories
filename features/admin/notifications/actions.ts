"use server";

import { getCurrentAdmin } from "@/services/admin-auth";
import {
  getUnreadNotificationCount,
  listNotificationsForAdmin,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotification,
} from "@/services/admin-notifications";

export type NotificationsActionResult =
  | { success: true; data: { notifications: AdminNotification[]; unreadCount: number } }
  | { success: false; error: string };

/** Fetches the signed-in admin's own notifications — never takes an adminId param, always resolves from the session, so one admin can never fetch another's. */
export async function fetchNotificationsAction(): Promise<NotificationsActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  const [notifications, unreadCount] = await Promise.all([
    listNotificationsForAdmin(admin.id),
    getUnreadNotificationCount(admin.id),
  ]);
  return { success: true, data: { notifications, unreadCount } };
}

export async function markNotificationReadAction(id: string): Promise<{ success: boolean }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false };
  try {
    await markNotificationRead(id, admin.id);
    return { success: true };
  } catch (err) {
    console.error("markNotificationReadAction failed:", err);
    return { success: false };
  }
}

export async function markAllNotificationsReadAction(): Promise<{ success: boolean }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { success: false };
  try {
    await markAllNotificationsRead(admin.id);
    return { success: true };
  } catch (err) {
    console.error("markAllNotificationsReadAction failed:", err);
    return { success: false };
  }
}
