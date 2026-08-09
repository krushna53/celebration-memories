"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  fetchNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/admin/notifications/actions";
import type { AdminNotification } from "@/services/admin-notifications";

const POLL_INTERVAL_MS = 60_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Bell icon + dropdown panel in the admin header, for the shared
 * notification center covering RSVP alerts, daily feature-discovery
 * nudges, storage-quota warnings, and post-event "new plans" prompts
 * (see services/admin-notifications.ts). Polls every 60s rather than
 * using Supabase Realtime — this app has no other Realtime subscription
 * anywhere, and a once-a-minute lag on an admin-facing notification
 * badge is a fine trade for not introducing a new real-time
 * infrastructure dependency for one small feature.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const result = await fetchNotificationsAction();
    if (result.success) {
      setNotifications(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function handleItemClick(notification: AdminNotification) {
    if (!notification.readAt) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationReadAction(notification.id).catch(() => {});
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await markAllNotificationsReadAction();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="tap-target relative flex h-8 w-8 items-center justify-center rounded-full text-ivory-100/80 transition-luxury duration-200 hover:text-gold-300"
      >
        <Bell size={17} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-semibold text-navy-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[90vw] rounded-xl border border-navy-950/10 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-navy-950/10 px-4 py-3">
            <h3 className="font-display text-sm text-navy-950">Notifications</h3>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="tap-target flex items-center gap-1 text-xs font-medium text-gold-600 hover:text-gold-700"
              >
                <Check size={12} /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-navy-700/40">
                <Loader2 className="animate-spin" size={18} />
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-navy-700/50">You&rsquo;re all caught up.</p>
            ) : (
              notifications.map((notification) => {
                const content = (
                  <div
                    className={cn(
                      "border-b border-navy-950/5 px-4 py-3 text-left transition-luxury duration-150 last:border-b-0 hover:bg-ivory-50",
                      !notification.readAt && "bg-gold-500/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.readAt ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                      ) : (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-navy-950">{notification.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-navy-700/60">{notification.body}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-navy-700/35">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                return notification.link ? (
                  <Link key={notification.id} href={notification.link} onClick={() => handleItemClick(notification)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleItemClick(notification)}
                    className="block w-full"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
