"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, FlaskConical, LayoutDashboard, LayoutTemplate, ListChecks, Loader2, Mail, Plus, RotateCcw, Settings, Users } from "lucide-react";

import type { MailerMode } from "@/lib/mailer/mode";
import { cn } from "@/lib/utils";
import { MailerProvider, useMailerStatus } from "@/features/mailer/mailer-provider";
import type { MailerCall } from "@/features/mailer/repository";
import { MailerNavContext, type MailerView } from "@/features/mailer/mailer-nav";
import { CampaignsView, DashboardView, NewCampaignTiles } from "@/features/mailer/components/campaigns-view";
import { CampaignEditor } from "@/features/mailer/components/campaign-editor";
import { CampaignDetail } from "@/features/mailer/components/campaign-detail";
import { AnalyticsView } from "@/features/mailer/components/analytics-view";
import { ContactsView } from "@/features/mailer/components/contacts-view";
import { ListsView } from "@/features/mailer/components/lists-view";
import { TemplatesView } from "@/features/mailer/components/templates-view";
import { ErrorText, Modal, primaryButton, secondaryButton } from "@/features/mailer/components/ui";

type Section = "dashboard" | "campaigns" | "analytics" | "contacts" | "lists" | "templates";

const SECTIONS: { id: Section; label: string; icon: LucideIcon; title: string; subtitle: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, title: "Dashboard", subtitle: "Here's how your email campaigns are doing." },
  { id: "campaigns", label: "Campaigns", icon: Mail, title: "Campaigns", subtitle: "Greetings, invitations and announcements." },
  { id: "analytics", label: "Analytics", icon: BarChart3, title: "Analytics", subtitle: "Delivery and click statistics across campaigns." },
  { id: "contacts", label: "Contacts", icon: Users, title: "Contacts", subtitle: "Everyone you can email, linked to your events." },
  { id: "lists", label: "Lists", icon: ListChecks, title: "Lists", subtitle: "Groups of contacts to send to together." },
  { id: "templates", label: "Templates", icon: LayoutTemplate, title: "Templates", subtitle: "Reusable designs for each kind of email." },
];

const EMAIL_SETTINGS_HREF = "/admin/mailer/email-settings";

/** Entry point for /admin/mailer — everything below runs in the browser. */
export function MailerApp({
  mode,
  call,
  emailSettingsHref = EMAIL_SETTINGS_HREF,
}: {
  mode: MailerMode;
  /** Live mode: the Server Action every Mailer read/write goes through. */
  call?: MailerCall;
  emailSettingsHref?: string;
}) {
  return (
    <MailerProvider mode={mode} call={call}>
      <MailerShell emailSettingsHref={emailSettingsHref} />
    </MailerProvider>
  );
}

function sectionOf(view: MailerView): Section {
  if (view.name === "campaign" || view.name === "editor") return "campaigns";
  return view.name;
}

function MailerShell({ emailSettingsHref }: { emailSettingsHref: string }) {
  const { mode, data, loadError, run } = useMailerStatus();
  const [view, setView] = useState<MailerView>({ name: "dashboard" });
  const [picking, setPicking] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const navigate = (next: MailerView) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (mode === "supabase") {
    return (
      <div className="rounded-2xl border border-navy-950/10 bg-white p-6">
        <h1 className="font-display text-2xl text-navy-950">Event Mailer</h1>
        <p className="mt-2 max-w-xl text-sm text-navy-700/75">
          The Mailer&rsquo;s database isn&rsquo;t set up yet, so it only runs in mock mode for now. Add{" "}
          <code className="rounded bg-navy-950/5 px-1 py-0.5">NEXT_PUBLIC_MAILER_MODE=mock</code> to <code className="rounded bg-navy-950/5 px-1 py-0.5">.env.local</code>{" "}
          and restart the dev server to try it with demo data. Nothing is sent in mock mode.
        </p>
        <Link href={emailSettingsHref} className={cn(secondaryButton, "mt-4")}>
          <Settings size={15} /> Email Settings
        </Link>
      </div>
    );
  }

  if (loadError) return <ErrorText>{loadError}</ErrorText>;
  if (!data) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-navy-700/60">
        <Loader2 size={16} className="animate-spin" /> Loading the Mailer...
      </div>
    );
  }

  const active = sectionOf(view);
  const section = SECTIONS.find((s) => s.id === active)!;

  async function resetDemo() {
    if (!confirm("Reset the Mailer to the demo data? Your contacts, lists, templates and campaigns in this browser will be replaced.")) return;
    const result = await run((repo) => repo.resetDemoData());
    if (result.ok) {
      setResetError(null);
      setView({ name: "dashboard" });
    } else setResetError(result.error);
  }

  return (
    <MailerNavContext.Provider value={navigate}>
      <div className="rounded-3xl border border-navy-950/[0.07] bg-[#fafafb] p-2 sm:p-3">
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          {/* Sidebar (a scrolling tab row on phones) */}
          <aside className="md:w-52 md:shrink-0">
            <div className="rounded-2xl bg-white p-3 md:sticky md:top-4">
              <div className="flex items-center gap-2 px-1 pb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-500 text-white">
                  <Mail size={16} />
                </span>
                <span className="font-display text-lg text-navy-950">Event Mailer</span>
              </div>
              <nav aria-label="Mailer" className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:mx-0 md:flex-col md:overflow-visible md:pb-0">
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate({ name: s.id } as MailerView)}
                    aria-current={active === s.id ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
                      active === s.id ? "bg-navy-950/[0.06] font-medium text-navy-950" : "text-navy-700/70 hover:bg-navy-950/[0.03] hover:text-navy-950",
                    )}
                  >
                    <s.icon size={16} aria-hidden="true" />
                    {s.label}
                  </button>
                ))}
                {/* Real (server-side) settings — a separate page, not part of the mock data. */}
                <Link
                  href={emailSettingsHref}
                  className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-navy-700/70 transition hover:bg-navy-950/[0.03] hover:text-navy-950 md:mt-2 md:border-t md:border-navy-950/[0.06] md:pt-3"
                >
                  <Settings size={16} aria-hidden="true" />
                  Email Settings
                </Link>
              </nav>
              {mode === "mock" ? (
                <div className="mt-4 hidden rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 md:block">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <FlaskConical size={13} /> Mock mode
                  </p>
                  <p className="mt-1">Saved in this browser only. No real email is sent.</p>
                  <button type="button" onClick={resetDemo} className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2">
                    <RotateCcw size={12} /> Reset demo data
                  </button>
                </div>
              ) : (
                <div className="mt-4 hidden rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 md:block">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <Mail size={13} /> Live mode
                  </p>
                  <p className="mt-1">Saved on the server. Campaigns send real email through your verified Email Settings.</p>
                </div>
              )}
            </div>
          </aside>

          {/* Main */}
          <main className="min-w-0 flex-1 rounded-2xl bg-white p-4 sm:p-6">
            {mode === "mock" ? (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 md:hidden">
                <FlaskConical size={14} className="mt-0.5 shrink-0" />
                <p className="flex-1">Mock mode — saved in this browser only, no real email is sent.</p>
                <button type="button" onClick={resetDemo} className="shrink-0 font-medium underline">
                  Reset
                </button>
              </div>
            ) : (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 md:hidden">
                <Mail size={14} className="mt-0.5 shrink-0" />
                <p className="flex-1">Live mode — campaigns send real email.</p>
              </div>
            )}
            <ErrorText>{resetError}</ErrorText>

            {view.name !== "editor" && view.name !== "campaign" ? (
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl text-navy-950 sm:text-3xl">{section.title}</h1>
                  <p className="mt-1 text-sm text-navy-700/60">{section.subtitle}</p>
                </div>
                <button type="button" onClick={() => setPicking(true)} className={primaryButton}>
                  <Plus size={16} /> New Campaign
                </button>
              </div>
            ) : null}

            {view.name === "dashboard" ? <DashboardView /> : null}
            {view.name === "campaigns" ? <CampaignsView /> : null}
            {view.name === "analytics" ? <AnalyticsView /> : null}
            {view.name === "contacts" ? <ContactsView /> : null}
            {view.name === "lists" ? <ListsView /> : null}
            {view.name === "templates" ? <TemplatesView /> : null}
            {view.name === "campaign" ? <CampaignDetail key={view.id} id={view.id} /> : null}
            {view.name === "editor" ? <CampaignEditor key={view.id ?? `new-${view.kind}`} id={view.id} kind={view.kind} /> : null}
          </main>
        </div>
      </div>

      {picking ? (
        <Modal title="What kind of campaign?" onClose={() => setPicking(false)} wide>
          <NewCampaignTiles onPick={() => setPicking(false)} />
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => setPicking(false)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </MailerNavContext.Provider>
  );
}
