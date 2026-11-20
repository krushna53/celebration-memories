/**
 * Netlify Scheduled Function — Event Mailer automations.
 *
 * Calls /api/cron/mailer-automations (app/api/cron/mailer-automations/route.ts),
 * which sends the birthday greetings, HR birthday reminders and
 * work-anniversary emails that are due today for every company.
 *
 * Runs every hour from 09:00 to 18:00 India time (03:30–12:30 UTC — Netlify
 * schedules are in UTC). The first run sends the day's emails; the later
 * ones retry anything that failed. The route never sends the same email
 * twice, so the repeats are harmless.
 *
 * Needs CRON_SECRET in the site's environment variables (the same secret
 * the route checks). Scheduled functions only run on the published
 * production deploy — not locally or on deploy previews; locally use
 * "Send due emails now" on the Mailer's Automations page.
 */

async function runMailerAutomations() {
  const secret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL; // the site's primary URL, set by Netlify
  if (!secret || !siteUrl) {
    console.error("mailer-automations: CRON_SECRET or URL is not set — skipping.");
    return;
  }

  try {
    const res = await fetch(`${siteUrl.replace(/\/$/, "")}/api/cron/mailer-automations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    if (res.ok) console.log("mailer-automations:", body);
    else console.error(`mailer-automations: route answered ${res.status}`, body.slice(0, 300));
  } catch (err) {
    console.error("mailer-automations: request failed", err instanceof Error ? err.message : err);
  }
}

export default runMailerAutomations;

export const config = {
  // minute 30, hours 3–12 UTC = 09:00–18:00 India time, every day
  schedule: "30 3-12 * * *",
};
