"use client";

import { useRouter } from "next/navigation";

import { RsvpFormBuilder } from "@/features/admin/rsvp-form/rsvp-form-builder";
import { saveRsvpConfigAction } from "@/features/admin/rsvp-form/actions";
import type { RsvpConfig } from "@/lib/rsvp-config";

/** Dashboard wrapper: binds the builder to this event's admin save action. */
export function AdminRsvpFormBuilder({ eventId, initialConfig, corporate }: { eventId: string; initialConfig: RsvpConfig; corporate: boolean }) {
  const router = useRouter();
  return (
    <RsvpFormBuilder
      initialConfig={initialConfig}
      corporate={corporate}
      saveAction={(config) => saveRsvpConfigAction(eventId, config)}
      onSaved={() => router.refresh()}
    />
  );
}
