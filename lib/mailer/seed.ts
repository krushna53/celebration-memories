import type {
  ContactRole,
  MailerCampaign,
  MailerContact,
  MailerData,
  MailerEvent,
  MailerList,
  MailerTemplate,
} from "@/types/mailer";
import { contactDisplayName } from "@/lib/mailer/email";
import { simulateSend } from "@/lib/mailer/simulate";
import { addDays, todayIn } from "@/lib/mailer/automations";

/**
 * Demo data for mock mode. The events here stand in for EveryMoment
 * events — they are not rows from the real `events` table, and nothing
 * here touches it. Every email address uses the reserved ".example"
 * domain (or ".invalid" for the forced bounce), so even if one were ever
 * sent for real it couldn't reach a person.
 */

/** Small seeded PRNG so the demo campaign's results look the same on every reset. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_EVENTS: MailerEvent[] = [
  { id: "demo-event-annual-day", name: "Acme Annual Day 2026", date: "2026-12-12", venue: "Jio World Convention Centre, Mumbai" },
  { id: "demo-event-offsite", name: "Year-End Leadership Offsite", date: "2026-12-19", venue: "Della Resorts, Lonavala" },
  { id: "demo-event-client-dinner", name: "Client Appreciation Dinner", date: "2027-01-16", venue: "The Leela Palace, Bengaluru" },
];

const DEMO_PEOPLE: [string, string, string, string, string, string[]][] = [
  // first, last, email, company, phone, events
  ["Priya", "Sharma", "priya.sharma@acme.example", "Acme Industries", "+91 98200 10001", ["demo-event-annual-day", "demo-event-offsite"]],
  ["Arjun", "Nair", "arjun.nair@acme.example", "Acme Industries", "+91 98200 10002", ["demo-event-annual-day"]],
  ["Meera", "Kapoor", "meera.kapoor@acme.example", "Acme Industries", "+91 98200 10003", ["demo-event-annual-day", "demo-event-offsite"]],
  ["Vikram", "Singh", "vikram.singh@acme.example", "Acme Industries", "+91 98200 10004", ["demo-event-offsite"]],
  ["Sneha", "Reddy", "sneha.reddy@acme.example", "Acme Industries", "", ["demo-event-annual-day"]],
  ["Rohan", "Desai", "rohan.desai@globex.example", "Globex Corp", "+91 99300 20001", ["demo-event-client-dinner"]],
  ["Kavya", "Menon", "kavya.menon@globex.example", "Globex Corp", "", ["demo-event-client-dinner"]],
  ["Aditya", "Rao", "aditya.rao@initech.example", "Initech", "+91 99300 20003", ["demo-event-client-dinner"]],
  ["Neha", "Joshi", "neha.joshi@initech.example", "Initech", "", []],
  ["Sanjay", "Gupta", "sanjay.gupta@umbrella.example", "Umbrella Logistics", "+91 99300 20005", ["demo-event-client-dinner"]],
  ["Farah", "Khan", "farah.khan@umbrella.example", "Umbrella Logistics", "", []],
  ["Ishaan", "Verma", "ishaan.verma@stark.example", "Stark Textiles", "+91 99300 20007", []],
  ["Bounce", "Demo", "bounce.demo@oldcompany.invalid", "Old Company", "", []],
  ["Ritu", "Bose", "ritu.bose@acme.example", "Acme Industries", "", ["demo-event-annual-day"]],
];

/** Roles for DEMO_PEOPLE, same order. */
const DEMO_ROLES: ContactRole[][] = [
  ["manager", "member"],
  ["employee", "subscriber"],
  ["admin", "employee"],
  ["manager", "employee"],
  ["employee"],
  ["client", "partner"],
  ["client"],
  ["customer", "partner"],
  ["customer", "subscriber"],
  ["vendor"],
  ["client", "subscriber"],
  ["guest"],
  ["subscriber"],
  ["hr", "employee"],
];

/**
 * Demo birthdays and joining dates, as [days from today, year] — relative to
 * "today" so the automations always have something to show: a birthday
 * today, one tomorrow (HR reminder), a work anniversary today, and a few
 * coming up. Indexes match DEMO_PEOPLE.
 */
const DEMO_BIRTHDAYS: Record<number, [number, number]> = { 0: [0, 1992], 1: [1, 1990], 4: [10, 1995], 7: [21, 1988], 13: [40, 1991] };
const DEMO_JOINING: Record<number, [number, number]> = { 0: [-200, 2021], 2: [0, 2023], 3: [5, 2024], 4: [-30, 2025], 13: [-90, 2019] };

function demoDate(today: string, [offset, year]: [number, number]): string {
  return `${year}${addDays(today, offset).slice(4)}`.replace(/-02-29$/, "-02-28");
}

export const BUILT_IN_TEMPLATE_IDS = {
  diwali: "tpl-diwali",
  new_year: "tpl-new-year",
  invitation: "tpl-invitation",
  announcement: "tpl-announcement",
} as const;

function demoTemplates(now: string): MailerTemplate[] {
  return [
    {
      id: BUILT_IN_TEMPLATE_IDS.diwali,
      name: "Diwali Greeting",
      kind: "diwali",
      subject: "Wishing you a bright and joyful Diwali, {{first_name}}",
      preheader: "Warm wishes from all of us at {{sender_name}}",
      body:
        "Dear {{first_name}},\n\nAs the diyas light up homes across the country, we want to thank you for being part of our journey this year. Your trust and partnership mean the world to us.\n\nMay this Diwali bring you and your family health, happiness and prosperity.\n\nWarm wishes,\n{{sender_name}}",
      ctaLabel: "",
      ctaUrl: "",
      builtIn: true,
      updatedAt: now,
    },
    {
      id: BUILT_IN_TEMPLATE_IDS.new_year,
      name: "New Year Greeting",
      kind: "new_year",
      subject: "Here's to a wonderful 2027, {{first_name}}",
      preheader: "Thank you for an amazing year together",
      body:
        "Dear {{first_name}},\n\nAs we close the year, we're grateful for everything we've achieved together with {{company}}.\n\nWe look forward to an even better year ahead. Wishing you a happy and successful New Year!\n\nCheers,\n{{sender_name}}",
      ctaLabel: "",
      ctaUrl: "",
      builtIn: true,
      updatedAt: now,
    },
    {
      id: BUILT_IN_TEMPLATE_IDS.invitation,
      name: "Event Invitation",
      kind: "invitation",
      subject: "You're invited: {{event_name}}",
      preheader: "{{event_date}} · {{event_venue}}",
      body:
        "Dear {{first_name}},\n\nWe'd be delighted to have you with us at {{event_name}}.\n\nDate: {{event_date}}\nVenue: {{event_venue}}\n\nPlease let us know if you can make it by replying to this email or using the button below.\n\nLooking forward to seeing you,\n{{sender_name}}",
      ctaLabel: "RSVP now",
      ctaUrl: "https://everymoment.in",
      builtIn: true,
      updatedAt: now,
    },
    {
      id: BUILT_IN_TEMPLATE_IDS.announcement,
      name: "Announcement",
      kind: "announcement",
      subject: "An update from {{sender_name}}",
      preheader: "A quick note for {{first_name}}",
      body:
        "Hi {{first_name}},\n\nWe have some news to share with you.\n\n[Write your announcement here.]\n\nThank you,\n{{sender_name}}",
      ctaLabel: "",
      ctaUrl: "",
      builtIn: true,
      updatedAt: now,
    },
  ];
}

export function createDemoData(options: { now?: number; newId?: () => string } = {}): MailerData {
  const nowMs = options.now ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const today = todayIn(nowMs);
  let counter = 0;
  const newId = options.newId ?? (() => `demo-${(counter += 1).toString().padStart(3, "0")}`);

  const contacts: MailerContact[] = DEMO_PEOPLE.map(([firstName, lastName, email, company, phone, eventIds], i) => ({
    id: newId(),
    firstName,
    lastName,
    email,
    company,
    phone,
    eventIds,
    roles: [...(DEMO_ROLES[i] ?? [])],
    dateOfBirth: DEMO_BIRTHDAYS[i] ? demoDate(today, DEMO_BIRTHDAYS[i]) : "",
    joiningDate: DEMO_JOINING[i] ? demoDate(today, DEMO_JOINING[i]) : "",
    subscribed: true,
    createdAt: now,
    updatedAt: now,
  }));
  // One unsubscribed contact, to show that they're skipped when sending.
  contacts[11]!.subscribed = false;

  const byCompany = (company: string) => contacts.filter((c) => c.company === company).map((c) => c.id);
  const lists: MailerList[] = [
    {
      id: newId(),
      name: "Acme Employees",
      description: "Everyone at Acme Industries.",
      contactIds: byCompany("Acme Industries"),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      name: "Key Clients",
      description: "Clients we send festive greetings to.",
      contactIds: contacts.filter((c) => c.company !== "Acme Industries").map((c) => c.id),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      name: "Leadership Team",
      description: "Invited to the year-end offsite.",
      contactIds: contacts.filter((c) => c.eventIds.includes("demo-event-offsite")).map((c) => c.id),
      createdAt: now,
      updatedAt: now,
    },
  ];

  const templates = demoTemplates(now);
  const diwali = templates[0]!;
  const newYear = templates[1]!;

  // The Diwali campaign went out ~10 days ago — results come from the same simulator a real "send" uses.
  const sentAtMs = nowMs - 10 * 24 * 60 * 60 * 1000;
  const keyClients = lists[1]!;
  const diwaliRecipients = contacts
    .filter((c) => keyClients.contactIds.includes(c.id) && c.subscribed)
    .map((c) => ({ contactId: c.id, email: c.email, name: contactDisplayName(c) }));

  const campaigns: MailerCampaign[] = [
    {
      id: newId(),
      name: "Diwali 2026 — Client Greetings",
      kind: "diwali",
      templateId: diwali.id,
      senderName: "Team Acme",
      eventId: null,
      audience: { contactIds: [], listIds: [keyClients.id] },
      subject: diwali.subject,
      preheader: diwali.preheader,
      body: diwali.body,
      ctaLabel: diwali.ctaLabel,
      ctaUrl: diwali.ctaUrl,
      status: "sent",
      simulated: true,
      recipients: simulateSend(diwaliRecipients, { random: seededRandom(5), now: sentAtMs }),
      createdAt: new Date(sentAtMs - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(sentAtMs).toISOString(),
      sentAt: new Date(sentAtMs).toISOString(),
    },
    {
      id: newId(),
      name: "New Year 2027 — Everyone",
      kind: "new_year",
      templateId: newYear.id,
      senderName: "Team Acme",
      eventId: null,
      audience: { contactIds: [], listIds: [lists[0]!.id, keyClients.id] },
      subject: newYear.subject,
      preheader: newYear.preheader,
      body: newYear.body,
      ctaLabel: newYear.ctaLabel,
      ctaUrl: newYear.ctaUrl,
      status: "draft",
      simulated: true,
      recipients: [],
      createdAt: now,
      updatedAt: now,
      sentAt: null,
    },
  ];

  return { version: 1, events: DEMO_EVENTS.map((e) => ({ ...e })), contacts, lists, templates, campaigns };
}
