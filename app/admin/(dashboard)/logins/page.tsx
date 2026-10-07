import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/services/admin-auth";
import { listLoginActivity, type LoginActivityRow } from "@/services/login-activity";
import { formatCalendarDate, formatEventTime } from "@/lib/timezone";
import { StatCard } from "@/features/admin/components/stat-card";
import { LoginActivityTable, type LoginActivityDisplayRow } from "@/features/admin/logins/login-activity-table";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const KIND_LABELS = { business: "Business", forms: "Forms" } as const;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function timeAgo(iso: string, now: number): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86400) return relative.format(Math.round(seconds / 86400), "day");
  if (abs < 365 * 86400) return relative.format(Math.round(seconds / (30 * 86400)), "month");
  return relative.format(Math.round(seconds / (365 * 86400)), "year");
}

/** "Oct 7, 2026" in IST — the owner's own timezone; there's no per-event zone for a platform-wide page. */
function istDay(iso: string): string {
  const yyyyMmDd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
  return formatCalendarDate(yyyyMmDd);
}

function toDisplayRow(row: LoginActivityRow, now: number): LoginActivityDisplayRow {
  const badges = row.kinds.map((kind) => (kind === "admin" ? `Admin · ${row.adminRole ?? "client"}` : KIND_LABELS[kind]));
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    badges,
    lastSignIn: row.lastSignInAt ? `${istDay(row.lastSignInAt)} · ${formatEventTime(row.lastSignInAt)}` : null,
    lastSignInRelative: row.lastSignInAt ? timeAgo(row.lastSignInAt, now) : null,
    recent: row.lastSignInAt ? now - new Date(row.lastSignInAt).getTime() < 7 * DAY_MS : false,
    joined: istDay(row.createdAt),
  };
}

/**
 * Owner-only: when did each login last sign in? Covers every Supabase
 * Auth account on the platform — event admins, Marketplace vendors and
 * Build RSVP / Form owners — straight from auth.users.last_sign_in_at
 * (see services/login-activity.ts).
 */
export default async function AdminLoginsPage() {
  const admin = await getCurrentAdmin();
  if (admin?.role !== "owner") redirect("/admin");

  const rows = await listLoginActivity();
  const now = Date.now();
  const signedInWithin = (days: number) =>
    rows.filter((r) => r.lastSignInAt && now - new Date(r.lastSignInAt).getTime() < days * DAY_MS).length;

  return (
    <div>
      <h1 className="font-display text-2xl text-navy-950">Login Activity</h1>
      <p className="mt-1 text-sm text-navy-700/60">
        When each account last signed in — admins, Marketplace vendors and form owners. Staying signed in on a
        device doesn&rsquo;t count as a new login, so this shows the last time someone actually entered their
        password or used a sign-in link. Times are in IST.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total logins" value={rows.length} />
        <StatCard label="Last 24 hours" value={signedInWithin(1)} />
        <StatCard label="Last 7 days" value={signedInWithin(7)} />
        <StatCard label="Never signed in" value={rows.filter((r) => !r.lastSignInAt).length} />
      </div>

      <div className="mt-8">
        <LoginActivityTable rows={rows.map((row) => toDisplayRow(row, now))} />
      </div>
    </div>
  );
}
