"use client";

import { useCallback, useEffect, useState } from "react";

import { PUSH_CONFIGURED, PUSH_PUBLIC_KEY } from "@/lib/push";
import { savePushSubscriptionAction, removePushSubscriptionAction } from "@/features/push/actions";
import { canRequestPushNow } from "@/lib/pwa";

/** Converts a base64url VAPID public key into the Uint8Array pushManager.subscribe() expects. Standard Web Push boilerplate — see MDN's "Web Push API" guide. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied";

/**
 * Guest-facing half of the reminder system: lets a guest opt in to a
 * real OS-level push notification (e.g. "you started a video — want to
 * finish it?") on the current device. Feature-detected end to end —
 * unsupported browsers (no ServiceWorker/PushManager/Notification, or
 * PUSH_CONFIGURED false because no VAPID key is set) just report
 * "unsupported" rather than throwing, so callers can hide the prompt
 * entirely.
 */
export function usePushSubscription(token: string) {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported =
    PUSH_CONFIGURED &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    // Feature-detection alone reports true on non-installed iOS Safari
    // too, even though Apple blocks actually requesting permission
    // there — see lib/pwa.ts's canRequestPushNow for the real
    // platform constraint this additionally checks.
    canRequestPushNow();

  useEffect(() => {
    if (!supported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermissionState);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch(() => {
        // Service worker not ready / not registered yet — treat as not
        // subscribed rather than erroring; the subscribe() call below
        // will register/wait as needed if the guest opts in later.
      });
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);
      if (result !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast needed because lib.dom's BufferSource now requires an
        // ArrayBuffer-backed view specifically, while Uint8Array's own
        // type is backed by the broader ArrayBufferLike — a known
        // TypeScript lib nuance for pushManager.subscribe(), not a real
        // type mismatch (a plain Uint8Array is exactly what the Push API
        // expects and works fine at runtime).
        applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return false;
      }

      const saved = await savePushSubscriptionAction(
        token,
        { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
        navigator.userAgent,
      );
      setIsSubscribed(saved.success);
      return saved.success;
    } catch (err) {
      console.error("Push subscribe failed:", err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, token]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await removePushSubscriptionAction(token, endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setBusy(false);
    }
  }, [supported, token]);

  return { permission, isSubscribed, busy, supported, subscribe, unsubscribe };
}
