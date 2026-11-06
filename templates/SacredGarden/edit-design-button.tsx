import Link from "next/link";
import { Pencil } from "lucide-react";

import { supabaseAdmin } from "@/lib/supabase/admin";

async function isDemoEvent(eventId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().from("events").select("is_demo").eq("id", eventId).maybeSingle<{ is_demo: boolean }>();
    return !error && Boolean(data?.is_demo);
  } catch {
    return false;
  }
}

/** On a Sacred Garden sample only: opens the create page, where the visitor edits this same design with their own details. */
export async function EditDesignButton({ eventId }: { eventId: string }) {
  if (!(await isDemoEvent(eventId))) return null;
  return (
    <Link
      href="/wedding-websites/create"
      className="fixed bottom-24 left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#7a1f1f] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#5e1717]"
    >
      <Pencil size={15} aria-hidden="true" /> Edit this design
    </Link>
  );
}
