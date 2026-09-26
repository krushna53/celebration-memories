#!/usr/bin/env node
/**
 * Automated EveryMoment demo video — drives a real browser through the
 * live site with Playwright, overlays captions + a visible cursor, and
 * saves an MP4. Re-run it whenever the product changes and the demo
 * stays current with no manual re-recording.
 *
 * By default it builds a brand-new DEMO event through the /start wizard
 * (event details, timeline + gallery uploads using the placeholder images
 * in ../seed-demo-client-assets, a template, an AI invitation prompt, the
 * slideshow composer, review) and then tours the site it just built — so
 * no real guest's data is ever on screen. That run WRITES to whichever
 * site --base points at: one draft event (never published — it stops
 * before account creation/payment) plus its uploads, and the AI image
 * step spends one OpenAI generation (skip with --no-ai). The Slideshow
 * render is off by default (it spends Shotstack credits; --render-slideshow).
 *
 * The optional invite/game/admin scenes need a token or a saved admin
 * session — point them at a demo event, never a real guest list.
 *
 * Usage (from this folder):
 *   npm install && npx playwright install chromium   # once
 *   node record.mjs                 # desktop 1280x720, full wizard walkthrough
 *   node record.mjs --mobile        # phone-shaped 390x844
 *   node record.mjs --no-wizard --event <slug>   # read-only tour of an existing event
 *   node record.mjs --no-ai         # wizard, but only type the AI prompt (don't generate)
 *   node record.mjs --invite <token> --game <token> --admin
 *   node record.mjs --login         # sign in once by hand, saves session for --admin
 *   node record.mjs --backend --admin-event <demo event id> --admin-slug <its slug>
 *                                   # host dashboard walkthrough on a DEMO event (owner login)
 *   node record.mjs --extras --admin-event <id> --admin-slug <slug>
 *                                   # share-a-memory (photo/video/voice/guest book), games played for real,
 *                                   # Big Screen Display — needs public memories enabled on that demo event
 *
 * Output: ./output/everymoment-demo-<desktop|mobile>-<timestamp>.mp4
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");
const AUTH_FILE = path.join(__dirname, ".auth", "admin.json");
const ASSETS_DIR = path.join(__dirname, "..", "seed-demo-client-assets");
const asset = (name) => path.join(ASSETS_DIR, name);

// ---------------------------------------------------------------- config

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const config = {
  baseUrl: String(arg("base") || process.env.DEMO_BASE_URL || "https://everymoment.in").replace(/\/$/, ""),
  eventSlug: String(arg("event") || process.env.DEMO_EVENT_SLUG || "75th-birthday-mahesh-shah"),
  inviteToken: typeof arg("invite") === "string" ? arg("invite") : process.env.DEMO_INVITE_TOKEN || null,
  gameToken: typeof arg("game") === "string" ? arg("game") : process.env.DEMO_GAME_TOKEN || null,
  admin: Boolean(arg("admin")),
  mobile: Boolean(arg("mobile")),
  login: Boolean(arg("login")),
  headed: Boolean(arg("headed")),
  wizard: !arg("no-wizard"),
  generateAi: !arg("no-ai"),
  renderSlideshow: Boolean(arg("render-slideshow")),
  backend: Boolean(arg("backend")),
  extras: Boolean(arg("extras")),
  adminEventId: typeof arg("admin-event") === "string" ? arg("admin-event") : null,
  adminSlug: typeof arg("admin-slug") === "string" ? arg("admin-slug") : null,
  contactLine: process.env.DEMO_CONTACT_LINE || "WhatsApp +91 99879 82969",
};

const VIEWPORT = config.mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
// Record mobile at 2x so the phone-shaped video isn't blurry.
const VIDEO_SIZE = config.mobile ? { width: 780, height: 1688 } : { width: 1280, height: 720 };

// ------------------------------------------------------- page overlay

/**
 * Injected into every page before its own scripts run: a caption bar,
 * a visible cursor that follows Playwright's real mouse events (with a
 * ripple on click), and a full-screen outro card. Exposed on
 * window.__demo so the scenes below can drive it.
 */
const OVERLAY_SCRIPT = `
(() => {
  if (window.__demo) return;
  const css = \`
    #__demo-caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);
      max-width:88vw;padding:14px 26px;border-radius:999px;background:rgba(15,23,42,.88);color:#fff;
      font:600 clamp(15px,2.2vw,22px)/1.35 Poppins,system-ui,sans-serif;text-align:center;
      box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:2147483646;opacity:0;pointer-events:none;
      transition:opacity .45s ease,transform .45s ease}
    #__demo-caption.show{opacity:1;transform:translateX(-50%) translateY(0)}
    #__demo-caption b{color:#e9c46a}
    #__demo-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
      background:rgba(233,196,106,.55);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
      z-index:2147483647;pointer-events:none;transition:transform .12s ease;opacity:0}
    #__demo-cursor.down{transform:scale(.7)}
    .__demo-ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;
      border:3px solid #e9c46a;z-index:2147483646;pointer-events:none;animation:__demoRipple .6s ease-out forwards}
    @keyframes __demoRipple{to{transform:scale(4);opacity:0}}
    #__demo-outro{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:14px;background:#0f172a;color:#fff;text-align:center;padding:24px;z-index:2147483647;opacity:0;
      transition:opacity .8s ease;font-family:Poppins,system-ui,sans-serif}
    #__demo-outro.show{opacity:1}
    #__demo-outro h1{font:600 clamp(34px,6vw,64px)/1.1 "Playfair Display",Georgia,serif;margin:0}
    #__demo-outro p{margin:0;font-size:clamp(15px,2.4vw,24px);opacity:.85}
    #__demo-outro .accent{color:#e9c46a}
  \`;
  function mount() {
    if (document.getElementById("__demo-caption")) return;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    const caption = document.createElement("div");
    caption.id = "__demo-caption";
    const cursor = document.createElement("div");
    cursor.id = "__demo-cursor";
    document.body.append(caption, cursor);
    window.addEventListener("mousemove", (e) => {
      cursor.style.opacity = "1";
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
    }, true);
    window.addEventListener("mousedown", (e) => {
      cursor.classList.add("down");
      const r = document.createElement("div");
      r.className = "__demo-ripple";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }, true);
    window.addEventListener("mouseup", () => cursor.classList.remove("down"), true);
  }
  window.__demo = {
    caption(html) {
      mount();
      const el = document.getElementById("__demo-caption");
      if (!html) { el.classList.remove("show"); return; }
      el.innerHTML = html;
      el.classList.add("show");
    },
    outro(title, lines) {
      mount();
      const el = document.createElement("div");
      el.id = "__demo-outro";
      el.innerHTML = "<h1>" + title + "</h1>" + lines.map((l) => "<p>" + l + "</p>").join("");
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
    },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
`;

// ------------------------------------------------------------ helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function caption(page, html, holdMs = 0) {
  await page.evaluate((h) => window.__demo?.caption(h), html).catch(() => {});
  if (holdMs) await sleep(holdMs);
}

async function goto(page, urlPath) {
  await page.goto(config.baseUrl + urlPath, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await sleep(800);
}

/** Eased scroll to an absolute Y, so the video pans instead of jumping. */
async function scrollTo(page, y, durationMs = 1600) {
  await page.evaluate(
    ([targetY, duration]) =>
      new Promise((resolve) => {
        const startY = window.scrollY;
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        const endY = Math.max(0, Math.min(targetY, maxY));
        const t0 = performance.now();
        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        function step(now) {
          const t = Math.min(1, (now - t0) / duration);
          window.scrollTo(0, startY + (endY - startY) * ease(t));
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        }
        requestAnimationFrame(step);
      }),
    [y, durationMs],
  );
}

/** Scrolls so the element with this id sits near the top. Returns false if it isn't on the page. */
async function scrollToId(page, id, durationMs = 1600) {
  const y = await page.evaluate((elId) => {
    const el = document.getElementById(elId);
    return el ? el.getBoundingClientRect().top + window.scrollY - 70 : null;
  }, id);
  if (y === null) return false;
  await scrollTo(page, y, durationMs);
  return true;
}

/** Glides the visible cursor to a locator's centre, then clicks it. */
async function glideClick(page, locator) {
  // Centre it rather than just "in view" — sticky footers/preview panels
  // cover the viewport's bottom edge, and a raw mouse click there hits them.
  await locator.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await sleep(150);
  const box = await locator.boundingBox();
  if (!box) throw new Error("element not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await sleep(350);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
}

/** The page being recorded — lets scene() screenshot a failure without threading it through every call. */
let activePage = null;

/** Wall-clock start of the recording, and the [start, end] seconds of waits to fast-forward when encoding. */
let recordingStartedAt = 0;
const fastForwards = [];

/** Runs a slow wait (AI generation, renders) and marks it to play at 8x in the final video. */
async function fastForward(fn) {
  const start = (Date.now() - recordingStartedAt) / 1000;
  try {
    return await fn();
  } finally {
    fastForwards.push([start, (Date.now() - recordingStartedAt) / 1000]);
  }
}

/** Runs one scene; a missing element skips that scene (saving a screenshot of why) instead of killing the recording. */
async function scene(name, fn) {
  try {
    console.log(`▶ ${name}`);
    await fn();
  } catch (err) {
    console.warn(`  ↳ skipped "${name}": ${err instanceof Error ? err.message.split("\n")[0] : err}`);
    const shot = path.join(OUTPUT_DIR, `failed-${name.replace(/\W+/g, "-").toLowerCase()}.png`);
    await activePage?.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.warn(`    screenshot: ${path.relative(process.cwd(), shot)}`);
  }
}

/** The input/textarea/select that follows a <label> with this text (the wizard's labels aren't wired with htmlFor). */
function fieldByLabel(page, text) {
  const upper = text.toUpperCase().replace(/'/g, "");
  return page
    .locator(
      `xpath=//label[contains(translate(normalize-space(.),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ'),'${upper}')]/following::*[self::input or self::textarea or self::select][1]`,
    )
    .first();
}

/** Glides to a field, clears it, and types like a person would. */
async function typeInto(page, locator, text, delay = 35) {
  await glideClick(page, locator);
  await locator.fill("");
  await locator.pressSequentially(text, { delay });
  await sleep(250);
}

/** Clicks a button that opens a file picker and answers it with local files. */
async function uploadVia(page, trigger, files) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10_000 }),
    glideClick(page, trigger),
  ]);
  await chooser.setFiles(files);
}

/** The wizard's gold "next step" link (its text is the next step's label, so match on href). */
async function nextWizardStep(page, token, slug) {
  const link = page.locator(`a[href$="/start/${token}/${slug}"]`).last();
  if (await link.isVisible().catch(() => false)) {
    await glideClick(page, link);
    await page.waitForURL(new RegExp(`/start/${token}/${slug}`), { timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await sleep(800);
  } else {
    await goto(page, `/start/${token}/${slug}`);
  }
}

function futureDate(days) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Section-by-section tour of a public event page. */
async function tourEventPage(page, slug) {
  await goto(page, `/events/${slug}`);
  await caption(page, "Birthdays · anniversaries · reunions · weddings — <b>one event page</b>", 3500);
  const sections = [
    ["countdown", "A live countdown to the big day"],
    ["invitation", "A beautiful invitation, in your chosen template"],
    ["details", "Date, venue, <b>Google Maps</b> and directions"],
    ["gallery", "Photo gallery — memories through the years"],
    ["timeline", "Life milestones, told as a story"],
    ["rsvp", "<b>RSVP in seconds</b> — no app, no login"],
    ["wish", "Guests leave wishes for the family"],
    ["memories", "The <b>memory wall</b> — photos, videos &amp; voice messages"],
  ];
  for (const [id, text] of sections) {
    if (await scrollToId(page, id)) await caption(page, text, 2800);
  }
  await caption(page, "");
}

// ------------------------------------------------------------- scenes

/** Builds a demo event end to end through /start. Returns its public slug (or null if it didn't get that far). */
async function wizardScenes(page) {
  let token = null;
  let slug = null;

  await scene("Start", async () => {
    await goto(page, "/start");
    await caption(page, "Build your own event page — <b>no account needed to start</b>", 3000);
    await glideClick(page, page.getByRole("button", { name: /Get Started/ }));
    await page.waitForURL(/\/start\/[^/]+\/occasion/, { timeout: 30_000 });
    token = page.url().split("/start/")[1].split("/")[0];
    await sleep(1000);
  });
  if (!token) return null;

  await scene("Occasion & goals", async () => {
    await caption(page, "Pick the occasion", 1500);
    await glideClick(page, page.getByRole("button", { name: "Birthday", exact: true }));
    await page.waitForURL(/\/goals/, { timeout: 30_000 });
    await sleep(1000);
    await caption(page, "Choose what to build — an invitation card, a slideshow video, a full web page", 3200);
    await glideClick(page, page.getByRole("button", { name: "Continue" }));
    await page.waitForURL(/\/basics/, { timeout: 30_000 });
    await sleep(1000);
  });

  await scene("Event details", async () => {
    await caption(page, "A <b>live preview</b> of your page, right as you build it", 2800);
    // The preview is a sticky panel over the top of the form — collapse it
    // so the fields and Save button underneath stay clickable.
    await page.evaluate(() => {
      for (const d of document.querySelectorAll("details")) {
        if (d.querySelector("summary")?.textContent?.includes("Live Preview")) d.open = false;
      }
    });
    await caption(page, "Fill in the details once — everything else builds from them");
    await typeInto(page, fieldByLabel(page, "Honoree"), "Mahesh Mama");
    await typeInto(page, fieldByLabel(page, "Tagline"), "75 Years of Love & Laughter");
    await typeInto(page, fieldByLabel(page, "Hosted By"), "The Shah Family");
    await glideClick(page, page.getByRole("button", { name: "Generate from Name" }));
    await sleep(600);
    // Slugs are unique site-wide and every run builds a new event, so a
    // name-derived slug collides from the second run on — add a run suffix.
    await typeInto(page, fieldByLabel(page, "Slug"), `mahesh-mama-75-demo-${Date.now().toString(36).slice(-5)}`, 20);
    await fieldByLabel(page, "Starts").scrollIntoViewIfNeeded();
    const date = futureDate(45);
    const dates = page.locator('input[type="date"]');
    const times = page.locator('input[type="time"]');
    await glideClick(page, dates.nth(0));
    await dates.nth(0).fill(date);
    await times.nth(0).fill("11:00");
    await glideClick(page, dates.nth(1));
    await dates.nth(1).fill(date);
    await times.nth(1).fill("15:00");
    await typeInto(page, fieldByLabel(page, "Venue Name"), "Sunrise Banquet Hall");
    await typeInto(page, fieldByLabel(page, "Address"), "Andheri West, Mumbai");
    await typeInto(page, fieldByLabel(page, "Dress Code"), "Indian festive");
    await caption(page, "");
    await glideClick(page, page.getByRole("button", { name: /Save & Continue/ }));
    await page.waitForURL(/\/timeline/, { timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await sleep(1000);
  });

  await scene("Timeline", async () => {
    await caption(page, "Add life milestones — each one can carry a photo");
    const milestones = [
      ["1957", "Childhood", "Growing up in Surat", "childhood.jpg"],
      ["1987", "Wedding Day", "The start of a beautiful journey", "wedding.jpg"],
    ];
    for (const [i, [period, title, description, photo]] of milestones.entries()) {
      await typeInto(page, page.getByPlaceholder(/^Period/), period);
      await typeInto(page, page.getByPlaceholder("Title", { exact: true }), title);
      await typeInto(page, page.getByPlaceholder("Description", { exact: true }), description);
      await glideClick(page, page.getByRole("button", { name: /Add Milestone/ }));
      await page.waitForLoadState("load");
      await page.getByRole("button", { name: /Add photo|Replace photo/ }).nth(i).waitFor({ timeout: 20_000 });
      await sleep(600);
      await uploadVia(page, page.getByRole("button", { name: /Add photo/ }).first(), asset(photo));
      await page.waitForLoadState("load");
      await page.getByRole("button", { name: /Replace photo/ }).nth(i).waitFor({ timeout: 30_000 });
      await sleep(800);
    }
    await caption(page, "");
    await nextWizardStep(page, token, "gallery");
  });

  await scene("Gallery", async () => {
    await caption(page, "Upload photos in bulk — sorted into categories guests can browse", 1500);
    await uploadVia(page, page.getByRole("button", { name: /^Upload to/ }), [
      asset("family.jpg"),
      asset("friends.jpg"),
      asset("grandchildren.jpg"),
      asset("travel.jpg"),
    ]);
    // Uploads run one after another — wait for all four thumbnails before
    // moving on, or the next step's navigation interrupts the last upload.
    await page.waitForFunction(
      () => document.querySelectorAll('img[src*="/storage/v1/object/public/gallery/"]').length >= 4,
      null,
      { timeout: 90_000 },
    );
    await sleep(1500);
    await scrollTo(page, VIEWPORT.height * 0.6, 1500);
    await sleep(1500);
    await caption(page, "");
    await nextWizardStep(page, token, "template");
  });

  await scene("Template", async () => {
    await caption(page, "Choose from ready-made templates — or design your own colours", 2500);
    await scrollTo(page, VIEWPORT.height * 0.8, 2200);
    await sleep(800);
    await glideClick(page, page.getByRole("button", { name: /Golden Confetti/ }));
    await sleep(2500);
    await caption(page, "");
    await nextWizardStep(page, token, "ai-image");
  });

  await scene("AI invitation card", async () => {
    await caption(page, "Describe your invitation — <b>AI designs the card</b>");
    await typeInto(
      page,
      page.locator("textarea").first(),
      "A royal gold 75th birthday invitation for Mahesh Mama with soft floral borders, warm diya lights and elegant calligraphy",
      22,
    );
    if (config.generateAi) {
      await glideClick(page, page.getByRole("button", { name: /Generate Image/ }));
      await caption(page, "Generating your invitation card…");
      await fastForward(() => page.locator('img[alt="AI-generated invitation"]').waitFor({ timeout: 240_000 }));
      await sleep(800);
      await page.locator('img[alt="AI-generated invitation"]').scrollIntoViewIfNeeded();
      await caption(page, "Your invitation card — ready to share on WhatsApp", 3500);
    } else {
      await sleep(1500);
    }
    await caption(page, "");
    await nextWizardStep(page, token, "slideshow");
  });

  await scene("Slideshow", async () => {
    await caption(page, "Turn your photos into a <b>music-backed slideshow video</b>", 3000);
    await scrollTo(page, VIEWPORT.height * 0.7, 2000);
    await sleep(1500);
    if (config.renderSlideshow) {
      await glideClick(page, page.getByRole("button", { name: /Generate Video/ }));
      await caption(page, "Rendering…");
      await fastForward(() => page.locator("video").first().waitFor({ timeout: 300_000 }));
      await sleep(3000);
    }
    await caption(page, "");
    await nextWizardStep(page, token, "review");
  });

  await scene("Review", async () => {
    await caption(page, "Review everything before you create an account or pay anything", 3000);
    await scrollTo(page, 100_000, 3000);
    await sleep(1500);
    const href = await page.locator('a:has-text("View Your Site")').first().getAttribute("href");
    slug = href?.split("/events/")[1] ?? null;
    await caption(page, "");
  });

  return slug;
}

/** Opens an admin page with a caption, pans down it, and clears the caption — for pages that are shown, not operated. */
async function showAdminPage(page, urlPath, text, pans = 1) {
  await goto(page, urlPath);
  await caption(page, text, 2800);
  for (let i = 1; i <= pans; i++) {
    await scrollTo(page, i * VIEWPORT.height * 0.8, 1800);
    await sleep(1400);
  }
  await caption(page, "");
}

/**
 * The host dashboard, operated for real on the demo event: add + import
 * guests, send queue, a guest RSVPing and uploading from their own link,
 * check-in, moderation — then a tour of the other event tools.
 *
 * Guarded: refuses to record unless Event Settings shows the demo event's
 * slug, so a real client's guest list can never end up in the video.
 */
async function backendScenes(page) {
  let onDemoEvent = false;
  await scene("Confirm demo event", async () => {
    await goto(page, "/admin/event-settings");
    if (page.url().includes("/login")) throw new Error("admin session expired — run with --login again");
    const slug = await page.locator('input[value="' + config.adminSlug + '"]').count();
    if (!slug) throw new Error(`admin isn't pointed at ${config.adminSlug} — not recording the dashboard`);
    onDemoEvent = true;
  });
  if (!onDemoEvent) return;

  let inviteUrl = null;
  await scene("Invitees", async () => {
    await goto(page, "/admin/invitees");
    await caption(page, "Add guests one by one…");
    await glideClick(page, page.getByRole("button", { name: /Add Invitee/ }));
    await sleep(500);
    await typeInto(page, page.getByPlaceholder("Full name"), "Suresh Patel");
    await typeInto(page, page.getByPlaceholder("Phone (with country code)"), "+12025550106");
    await typeInto(page, page.getByPlaceholder("Relationship (optional)"), "Old friend");
    await glideClick(page, page.getByRole("button", { name: "Create Invitee" }));
    await page.getByText("Suresh Patel").first().waitFor({ timeout: 20_000 });
    await sleep(1000);

    await caption(page, "…or import the whole list from a spreadsheet (CSV)");
    await uploadVia(page, page.getByRole("button", { name: /Import CSV/ }), path.join(__dirname, "demo-guests.csv"));
    await page.getByText("Meera Kapoor").first().waitFor({ timeout: 30_000 });
    await sleep(1500);
    await caption(page, "Every guest gets their own <b>private invite link</b>", 2600);

    await caption(page, "<b>Bulk Send</b> — tap through the list, each WhatsApp message pre-written");
    await glideClick(page, page.getByRole("button", { name: /Bulk Send/ }));
    await sleep(3500);
    await glideClick(page, page.getByRole("button", { name: /Bulk Send/ }));
    await sleep(600);

    // Grab one guest's personal link (copied to the clipboard) for the guest-side scene.
    await glideClick(page, page.locator('button[title="Copy invite link"]').first());
    await sleep(400);
    inviteUrl = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    await caption(page, "");
  });

  if (inviteUrl?.includes("/invite/")) {
    await scene("Guest RSVPs and uploads", async () => {
      await page.goto(inviteUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await caption(page, "Meanwhile, on a guest's phone — their link already knows who they are", 3200);
      await scrollToId(page, "rsvp");
      await caption(page, "They RSVP in seconds");
      // Re-runs land on a guest who already replied — reopen their form.
      const edit = page.getByRole("button", { name: /Edit my RSVP/ });
      if (await edit.isVisible().catch(() => false)) await glideClick(page, edit);
      await glideClick(page, page.getByText("Joyfully Accepts", { exact: true }));
      const adults = page.locator("#adults");
      if (await adults.isVisible().catch(() => false)) await typeInto(page, adults, "2");
      await glideClick(page, page.locator('input[type="checkbox"]').last());
      await glideClick(page, page.getByRole("button", { name: /Submit RSVP/ }));
      await sleep(2500);

      await caption(page, "…and share photos straight from their phone");
      await glideClick(page, page.getByRole("button", { name: /Upload Image/ }).first());
      await sleep(800);
      await uploadVia(page, page.getByRole("button", { name: /Choose from Gallery/ }), asset("guest-upload.jpg"));
      await sleep(800);
      // "Upload" for one file, "Upload All" for several.
      await glideClick(page, page.getByRole("button", { name: /^Upload( All)?$/ }).first());
      await page.getByText(/uploaded|awaiting approval|Thank you/i).first().waitFor({ timeout: 45_000 }).catch(() => {});
      await sleep(2000);
      await caption(page, "");
    });
  }

  await scene("Moderation", async () => {
    await goto(page, "/admin/memories");
    await caption(page, "Every upload waits for <b>your approval</b> before it goes on the memory wall", 2600);
    const approve = page.locator('button[title="Approve"]').first();
    if (await approve.isVisible().catch(() => false)) {
      await glideClick(page, approve);
      await sleep(1500);
    }
    const feature = page.locator('button[title="Feature"]').first();
    if (await feature.isVisible().catch(() => false)) {
      await caption(page, "Feature the best ones");
      await glideClick(page, feature);
      await sleep(1500);
    }
    await caption(page, "");
  });

  await scene("Check-in", async () => {
    await goto(page, "/admin/checkin");
    await caption(page, "On the day — <b>check guests in</b> at the door");
    await typeInto(page, page.getByPlaceholder(/Search guest name/), "Suresh");
    await sleep(800);
    await glideClick(page, page.getByRole("button", { name: "Check In", exact: true }).first());
    await sleep(1500);
    await caption(page, "Live attendance, updated as people arrive", 2500);
    await caption(page, "");
  });

  await scene("Dashboard", async () => {
    await goto(page, "/admin");
    await caption(page, "Back on the <b>host dashboard</b> — it all adds up, live", 3200);
    await scrollTo(page, VIEWPORT.height * 0.8, 2000);
    await caption(page, "Invitations opened, RSVPs, uploads, attendance, most active guests", 2800);
    await scrollTo(page, VIEWPORT.height * 1.6, 2000);
    await sleep(1500);
    await caption(page, "");
  });

  await scene("Event settings", async () => {
    await showAdminPage(page, "/admin/event-settings", "Edit every detail — date, venue, timezone, WhatsApp message, section order", 3);
  });
  await scene("Event Day", async () => {
    await showAdminPage(page, "/admin/event-day", "Event Day — the schedule and menu guests see on the day", 1);
  });
  await scene("Games", async () => {
    await showAdminPage(page, "/admin/games", "Party games — Tambola and <b>Word Search</b> on guests' phones", 1);
  });
  await scene("Planner", async () => {
    await showAdminPage(page, "/admin/planner", "A planner board for the family's to-dos", 1);
  });
  await scene("Templates", async () => {
    await showAdminPage(page, "/admin/templates", "Switch templates any time — the whole site restyles instantly", 1);
  });
}

/** Opens the public "share a memory" page and gets past the name step, landing on the action tiles. */
async function openShareMemory(page) {
  await goto(page, `/events/${config.adminSlug}/memories`);
  const name = page.getByPlaceholder(/e\.g\. Priya/).first();
  if (await name.isVisible().catch(() => false)) {
    if (!(await name.inputValue())) await typeInto(page, name, "Priya (Mahesh's niece)");
  }
}

/** Records with the browser's fake camera/mic (see launch args), then uploads the take. */
async function recordAndUpload(page, tileName, seconds) {
  await glideClick(page, page.getByRole("button", { name: tileName }).first());
  await sleep(2500); // camera/mic warm-up
  // Video's record button is icon-only (aria-label), audio's has text — both resolve by accessible name.
  await glideClick(page, page.getByRole("button", { name: "Start Recording" }).filter({ visible: true }).first());
  await sleep(seconds * 1000);
  await glideClick(page, page.getByRole("button", { name: /^Stop$/ }).first());
  await sleep(800);
  await glideClick(page, page.getByRole("button", { name: /Done — Review/ }).first());
  await sleep(800);
  await glideClick(page, page.getByRole("button", { name: /^Upload( All)?$/ }).first());
  await sleep(4000);
}

/** Finds each word in the Word Search grid (any of 8 directions) and drags across it like a player would. */
async function solveWordSearch(page, words) {
  for (const word of words) {
    const span = await page.evaluate((w) => {
      const cells = [...document.querySelectorAll("[data-row][data-col]")];
      const grid = {};
      for (const el of cells) grid[`${el.dataset.row},${el.dataset.col}`] = el.textContent.trim().toUpperCase();
      const size = Math.round(Math.sqrt(cells.length));
      const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          for (const [dr, dc] of dirs) {
            let ok = true;
            for (let i = 0; i < w.length && ok; i++) ok = grid[`${r + dr * i},${c + dc * i}`] === w[i];
            if (ok) return [r, c, r + dr * (w.length - 1), c + dc * (w.length - 1)];
          }
      return null;
    }, word.toUpperCase());
    if (!span) continue;
    const center = async (r, c) => {
      const box = await page.locator(`[data-row="${r}"][data-col="${c}"]`).boundingBox();
      return [box.x + box.width / 2, box.y + box.height / 2];
    };
    const [sx, sy] = await center(span[0], span[1]);
    const [ex, ey] = await center(span[2], span[3]);
    await page.mouse.move(sx, sy, { steps: 15 });
    await sleep(200);
    await page.mouse.down();
    await page.mouse.move(ex, ey, { steps: 20 });
    await sleep(150);
    await page.mouse.up();
    await sleep(700);
  }
}

/** Creates a game on /admin/games (tab by label) and returns its guest link. */
async function createGame(page, tabLabel, title, wordsText) {
  await goto(page, "/admin/games");
  const tab = page.getByRole("button", { name: tabLabel, exact: true }).first();
  if (await tab.isVisible().catch(() => false)) await glideClick(page, tab);
  await typeInto(page, page.getByPlaceholder(/title — e\.g\./).first(), title);
  if (wordsText) await typeInto(page, page.locator("textarea").first(), wordsText, 25);
  await glideClick(page, page.getByRole("button", { name: /Create Game/ }));
  await page.getByText(title).first().waitFor({ timeout: 20_000 });
  await sleep(1500);
  // Games list newest first, so the first guest link on the page is the one
  // just created (even if an earlier run left a game with the same title).
  return page.evaluate(() => {
    const re = /https?:\/\/[^\s"'<>]+\/games\/[A-Za-z0-9_-]+/;
    for (const el of document.querySelectorAll("input, a, span, p, code, div")) {
      const text = el instanceof HTMLInputElement ? el.value : el.children.length === 0 ? el.textContent : "";
      const match = text?.match(re);
      if (match) return match[0];
    }
    return null;
  });
}

/** Share-a-memory flow, moderation onto the memory wall, games played for real, Big Screen Display. */
async function extrasScenes(page) {
  let onDemoEvent = false;
  await scene("Confirm demo event", async () => {
    await goto(page, "/admin/event-settings");
    if (page.url().includes("/login")) throw new Error("admin session expired — run with --login again");
    if (!(await page.locator(`input[value="${config.adminSlug}"]`).count())) {
      throw new Error(`admin isn't pointed at ${config.adminSlug} — not recording`);
    }
    onDemoEvent = true;
  });
  if (!onDemoEvent) return;

  // ---- Share a memory (one public link / QR for everyone, no invite needed)
  await scene("Share a memory — photo", async () => {
    await openShareMemory(page);
    await caption(page, "One link or QR code for everyone — guests <b>share a memory</b>, no app, no login", 3200);
    await glideClick(page, page.getByRole("button", { name: /Upload Image/ }).first());
    await sleep(800);
    await uploadVia(page, page.getByRole("button", { name: /Choose from Gallery/ }), asset("guest-upload.jpg"));
    await sleep(800);
    await glideClick(page, page.getByRole("button", { name: /^Upload( All)?$/ }).first());
    await sleep(3500);
    await caption(page, "");
  });
  await scene("Share a memory — video message", async () => {
    await openShareMemory(page);
    await caption(page, "Record a <b>video message</b> right in the browser");
    await recordAndUpload(page, /Record Video/, 5);
    await caption(page, "");
  });
  await scene("Share a memory — voice note", async () => {
    await openShareMemory(page);
    await caption(page, "…or a <b>voice note</b> for Mahesh Mama");
    await recordAndUpload(page, /Record Audio/, 4);
    await caption(page, "");
  });
  await scene("Share a memory — guest book", async () => {
    await openShareMemory(page);
    await caption(page, "…or write a wish in the <b>guest book</b>");
    await glideClick(page, page.getByRole("button", { name: /Add a Text Message/ }).first());
    await sleep(800);
    await typeInto(page, page.getByPlaceholder(/Share a wish/), "Happy 75th, Mama! Thank you for every story, every laugh and every cup of chai. Love you!", 25);
    await glideClick(page, page.getByRole("button", { name: /Sign the Guest Book/ }));
    await sleep(3000);
    await caption(page, "");
  });

  await scene("Approve onto the memory wall", async () => {
    await goto(page, "/admin/memories");
    await caption(page, "Everything lands in your approval queue first", 2500);
    for (let i = 0; i < 6; i++) {
      const approve = page.locator('button[title="Approve"]').first();
      if (!(await approve.isVisible().catch(() => false))) break;
      await glideClick(page, approve);
      await sleep(1200);
    }
    await caption(page, "");
    await goto(page, `/events/${config.adminSlug}`);
    if (await scrollToId(page, "memories")) {
      await caption(page, "…then it's live on the <b>memory wall</b> — photos, videos, voice notes, wishes", 3500);
      await scrollTo(page, (await page.evaluate(() => window.scrollY)) + VIEWPORT.height * 0.7, 2000);
      await sleep(1500);
    }
    await caption(page, "");
  });

  // ---- Games
  let wordSearchUrl = null;
  await scene("Create Word Search", async () => {
    await caption(page, "<b>Party games</b> — set one up in seconds");
    wordSearchUrl = await createGame(page, "Word Search", "Find Mahesh's Favourites", "MAHESH\nMUMBAI\nCRICKET\nFAMILY\nCHAI\nGOLF");
    await caption(page, "");
  });
  if (wordSearchUrl?.includes("/games/")) {
    await scene("Play Word Search", async () => {
      await page.goto(wordSearchUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await caption(page, "Guests open the game link on their phone", 2000);
      await typeInto(page, page.getByPlaceholder("Your name"), "Priya Shah");
      await typeInto(page, page.getByPlaceholder("Your phone number"), "+12025550101");
      await glideClick(page, page.getByRole("button", { name: /Start Puzzle/ }));
      await page.locator("[data-row][data-col]").first().waitFor({ timeout: 20_000 });
      await sleep(800);
      await caption(page, "…and race the clock to find every word");
      await solveWordSearch(page, ["MAHESH", "MUMBAI", "CRICKET", "FAMILY", "CHAI", "GOLF"]);
      await page.getByText(/All words found/).waitFor({ timeout: 10_000 }).catch(() => {});
      await caption(page, "Scores show up for the host — fastest finishers win", 3000);
      await caption(page, "");
    });
  }

  let housieUrl = null;
  await scene("Create Tambola", async () => {
    await caption(page, "Classic <b>Tambola / Housie</b> — tickets on every phone");
    housieUrl = await createGame(page, /^Housie/, "Mahesh's Birthday Tambola", null);
    await caption(page, "");
  });
  if (housieUrl?.includes("/games/")) {
    await scene("Play Tambola", async () => {
      await page.goto(housieUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await caption(page, "Each guest joins and gets their own ticket");
      await typeInto(page, page.getByPlaceholder("Your name"), "Rohan Mehta");
      await typeInto(page, page.getByPlaceholder("Your phone number"), "+12025550102");
      await glideClick(page, page.getByRole("button", { name: /Join Game/ }));
      await sleep(3000);
      await caption(page, "");

      await goto(page, "/admin/games");
      const tab = page.getByRole("button", { name: /^Housie/ }).first();
      if (await tab.isVisible().catch(() => false)) await glideClick(page, tab);
      await caption(page, "The host calls numbers live from their phone");
      await glideClick(page, page.getByRole("button", { name: /^Start$/ }).first());
      await sleep(1200);
      for (let i = 0; i < 6; i++) {
        await glideClick(page, page.getByRole("button", { name: /Call Next/ }).first());
        await sleep(900);
      }
      await caption(page, "");

      await page.goto(housieUrl, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      // The ticket page doesn't remember the guest across visits — joining
      // again with the same name + phone brings back the same ticket.
      const nameField = page.getByPlaceholder("Your name");
      if (await nameField.isVisible().catch(() => false)) {
        await typeInto(page, nameField, "Rohan Mehta", 20);
        await typeInto(page, page.getByPlaceholder("Your phone number"), "+12025550102", 20);
        await glideClick(page, page.getByRole("button", { name: /Join Game/ }));
        await sleep(2500);
      }
      await caption(page, "Guests see every number called — and claim prizes right from their ticket", 4000);
      await scrollTo(page, VIEWPORT.height * 0.6, 1800);
      await sleep(1500);
      await caption(page, "");
    });
  }

  await scene("Big Screen Display", async () => {
    await goto(page, `/events/${config.adminSlug}/display`);
    await caption(page, "<b>Big Screen Display</b> — put it on the TV or projector at the venue", 2500);
    const begin = page.getByText("Tap to Begin").first();
    if (await begin.isVisible().catch(() => false)) await glideClick(page, begin);
    await caption(page, "Photos, videos, voice notes and wishes play in a loop", 3000);
    await caption(page, "");
    await sleep(9000);
  });
}

async function runScenes(page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);

  if (config.backend) {
    await backendScenes(page);
    await outro(page);
    return;
  }
  if (config.extras) {
    await extrasScenes(page);
    await outro(page);
    return;
  }

  await scene("Homepage", async () => {
    await goto(page, "/");
    await caption(page, "<b>EveryMoment</b> — one page for every celebration", 3000);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const stops = Math.min(3, Math.floor(height / VIEWPORT.height));
    for (let i = 1; i <= stops; i++) {
      await scrollTo(page, i * VIEWPORT.height * 0.9, 1800);
      await sleep(1000);
    }
    await caption(page, "");
  });

  const builtSlug = config.wizard ? await wizardScenes(page) : null;
  if (config.wizard && builtSlug) console.log(`  ↳ demo event built: ${config.baseUrl}/events/${builtSlug}`);

  await scene("Event page", async () => {
    await tourEventPage(page, builtSlug ?? config.eventSlug);
  });

  if (config.inviteToken) {
    await scene("Personal invite", async () => {
      await goto(page, `/invite/${config.inviteToken}`);
      await caption(page, "Every guest gets a <b>personal WhatsApp link</b> — it knows who they are", 3500);
      if (await scrollToId(page, "rsvp")) await caption(page, "They RSVP — and can change it any time", 3000);
      await scrollTo(page, await page.evaluate(() => document.documentElement.scrollHeight), 2500);
      await caption(page, "…and upload photos, videos and voice messages from their phone", 3200);
      await caption(page, "");
    });
  }

  if (config.gameToken) {
    await scene("Word Search", async () => {
      await goto(page, `/games/${config.gameToken}`);
      await caption(page, "<b>Word Search</b> — played live on guests' phones", 4000);
      await caption(page, "");
    });
  }

  await scene("RSVP form builder", async () => {
    await goto(page, "/forms/new");
    await caption(page, "Need just an RSVP form? Build one for any occasion", 2500);
    await glideClick(page, page.getByText("Birthday", { exact: true }).first());
    await sleep(1200);
    await caption(page, "Start from suggested fields — or let <b>AI</b> build it from a description or photo", 3800);
    await caption(page, "");
  });

  if (config.admin) {
    await scene("Host dashboard", async () => {
      await goto(page, "/admin");
      if (page.url().includes("/login")) throw new Error("admin session expired — run with --login again");
      await caption(page, "The host dashboard — who opened, who's coming, who's checked in", 4000);
      await scrollTo(page, VIEWPORT.height * 0.9, 2000);
      await sleep(2000);
      await caption(page, "");
    });
  }

  await outro(page);
}

async function outro(page) {
  await scene("Outro", async () => {
    await page.evaluate(
      ([contact]) =>
        window.__demo?.outro("Every<span class='accent'>Moment</span>", [
          "Invites · RSVPs · memories · games — one page",
          "everymoment.in",
          `<span class='accent'>${contact}</span>`,
        ]),
      [config.contactLine],
    );
    await sleep(4500);
  });
}

// --------------------------------------------------------------- main

/**
 * ffmpeg filter that trims the blank first second and plays each
 * fast-forward stretch at 8x (the rest at normal speed), concatenated
 * back into one stream labelled [out].
 */
function buildTimelineFilter(ranges, speed = 8) {
  const cuts = [];
  let cursor = 1;
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    if (b - a < 3 || a < cursor) continue;
    cuts.push([cursor, a, 1], [a, b, speed]);
    cursor = b;
  }
  cuts.push([cursor, null, 1]);
  const parts = cuts.map(([from, to, rate], i) => {
    const trim = to === null ? `trim=start=${from.toFixed(2)}` : `trim=start=${from.toFixed(2)}:end=${to.toFixed(2)}`;
    return `[0:v]${trim},setpts=(PTS-STARTPTS)/${rate}[p${i}]`;
  });
  return `${parts.join(";")};${cuts.map((_, i) => `[p${i}]`).join("")}concat=n=${cuts.length}:v=1:a=0[out]`;
}

/**
 * Feeds the fake camera the placeholder "Happy 75th Birthday! From Priya
 * Shah" clip instead of Chrome's green test pattern. Mirrored on purpose:
 * the recorder previews the front camera mirrored, like a selfie, so this
 * reads the right way round on screen. Falls back to the test pattern if
 * ffmpeg isn't installed.
 */
function fakeCameraArgs() {
  const y4m = path.join(OUTPUT_DIR, ".media", "camera.y4m");
  try {
    if (!existsSync(y4m)) {
      mkdirSync(path.dirname(y4m), { recursive: true });
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", asset("guest-video.mp4"), "-vf", "hflip,scale=640:360,fps=15", "-pix_fmt", "yuv420p", y4m]);
    }
    return [`--use-file-for-fake-video-capture=${y4m}`];
  } catch {
    return [];
  }
}

async function saveLogin() {
  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  // Real Google Chrome with its own throwaway profile, minus the automation
  // flag — Google's OAuth rejects Playwright's bundled Chromium as "not
  // secure", which blocks "Continue with Google".
  const context = await chromium.launchPersistentContext(path.join(__dirname, ".auth", "chrome-profile"), {
    channel: "chrome",
    headless: false,
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${config.baseUrl}/login`);
  console.log("Sign in in the Chrome window that just opened. Waiting for /admin…");
  await page.waitForURL(/\/admin(\/|\?|$)/, { timeout: 20 * 60_000 });
  await context.storageState({ path: AUTH_FILE });
  console.log(`Saved session to ${path.relative(process.cwd(), AUTH_FILE)} — now run with --admin.`);
  await context.close();
}

async function record() {
  const needsAdminEvent = config.backend || config.extras;
  if (needsAdminEvent && (!config.adminEventId || !config.adminSlug)) {
    console.error("--backend/--extras need --admin-event <event id> and --admin-slug <that event's slug> (a DEMO event)");
    process.exit(1);
  }
  if (needsAdminEvent) config.admin = true;
  if (config.admin && !existsSync(AUTH_FILE)) {
    console.error("--admin needs a saved session first: node record.mjs --login");
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const rawDir = path.join(OUTPUT_DIR, ".raw");
  rmSync(rawDir, { recursive: true, force: true });

  const browser = await chromium.launch({
    headless: !config.headed,
    // A synthetic camera + mic so the in-browser video/voice recorders can
    // be demoed without real hardware — see fakeCameraArgs().
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", ...fakeCameraArgs()],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: config.mobile ? 2 : 1,
    isMobile: config.mobile,
    hasTouch: false, // keep mouse events so the visible cursor works
    userAgent: config.mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : undefined,
    recordVideo: { dir: rawDir, size: VIDEO_SIZE },
    storageState: config.admin ? AUTH_FILE : undefined,
    locale: "en-IN",
  });
  await context.addInitScript(OVERLAY_SCRIPT);
  // Headless fullscreen (the video recorder and Big Screen Display both
  // request it) resizes the page out from under the video capture and
  // leaves grey bars — the pages already fill the viewport, so no-op it.
  await context.addInitScript(() => {
    Element.prototype.requestFullscreen = function () {
      return Promise.resolve();
    };
  });
  if (needsAdminEvent) {
    // The owner's "active event" override (lib/admin-active-event.ts) — points
    // every event-scoped admin page at the demo event for this recording only.
    await context.addCookies([
      {
        name: "cm_admin_active_event",
        value: config.adminEventId,
        domain: new URL(config.baseUrl).hostname,
        path: "/admin",
        httpOnly: true,
        secure: config.baseUrl.startsWith("https"),
        sameSite: "Lax",
      },
    ]);
    await context.grantPermissions(["clipboard-read", "clipboard-write", "camera", "microphone"], { origin: config.baseUrl });
  }
  // Keep the one-per-visit banners/tours out of the video.
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("em_concierge_dismissed", "1");
    } catch {}
  });

  const page = await context.newPage();
  activePage = page;
  recordingStartedAt = Date.now();
  const started = recordingStartedAt;
  await runScenes(page);
  const video = page.video();
  await context.close();
  await browser.close();

  const rawPath = await video.path();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outPath = path.join(OUTPUT_DIR, `everymoment-${config.backend ? "backend" : config.extras ? "extras" : "demo"}-${config.mobile ? "mobile" : "desktop"}-${stamp}.mp4`);
  try {
    // Trim the blank first second, convert WebM → H.264 MP4 (plays everywhere, uploads to YouTube/WhatsApp).
    execFileSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error", "-i", rawPath,
        "-filter_complex", buildTimelineFilter(fastForwards), "-map", "[out]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", outPath,
      ],
      { stdio: "inherit" },
    );
    rmSync(rawDir, { recursive: true, force: true });
  } catch {
    const fallback = outPath.replace(/\.mp4$/, ".webm");
    renameSync(rawPath, fallback);
    console.warn("ffmpeg not available — kept the raw WebM instead.");
    console.log(`\n✔ ${path.relative(process.cwd(), fallback)}`);
    return;
  }
  console.log(`\n✔ ${path.relative(process.cwd(), outPath)}  (${Math.round((Date.now() - started) / 1000)}s recorded)`);
}

(config.login ? saveLogin() : record()).catch((err) => {
  console.error(err);
  process.exit(1);
});
