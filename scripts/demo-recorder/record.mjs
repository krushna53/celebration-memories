#!/usr/bin/env node
/**
 * Automated EveryMoment demo video — drives a real browser through the
 * live site with Playwright, overlays captions + a visible cursor, and
 * saves an MP4. Re-run it whenever the product changes and the demo
 * stays current with no manual re-recording.
 *
 * Read-only by default: every scene only navigates, scrolls, and clicks
 * things that don't write data (no RSVP submit, no draft creation, no
 * uploads). The optional scenes need a token or a saved admin session —
 * point them at a demo event, never a real guest list, since whatever
 * is on screen ends up in the video.
 *
 * Usage (from this folder):
 *   npm install && npx playwright install chromium   # once
 *   node record.mjs                 # desktop 1280x720
 *   node record.mjs --mobile        # phone-shaped 390x844
 *   node record.mjs --event <slug> --invite <token> --game <token> --admin
 *   node record.mjs --login         # sign in once by hand, saves session for --admin
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
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await sleep(350);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
}

/** Runs one scene; a missing element skips that scene instead of killing the whole recording. */
async function scene(name, fn) {
  try {
    console.log(`▶ ${name}`);
    await fn();
  } catch (err) {
    console.warn(`  ↳ skipped "${name}": ${err instanceof Error ? err.message : err}`);
  }
}

// ------------------------------------------------------------- scenes

async function runScenes(page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);

  await scene("Homepage", async () => {
    await goto(page, "/");
    await caption(page, "<b>EveryMoment</b> — one page for every celebration", 3000);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const stops = Math.min(4, Math.floor(height / VIEWPORT.height));
    for (let i = 1; i <= stops; i++) {
      await scrollTo(page, i * VIEWPORT.height * 0.9, 1800);
      await sleep(1200);
    }
    await caption(page, "");
  });

  await scene("Event page", async () => {
    await goto(page, `/events/${config.eventSlug}`);
    await caption(page, "Birthdays · anniversaries · reunions · weddings — <b>one event page</b>", 3500);
    const sections = [
      ["countdown", "A live countdown to the big day"],
      ["invitation", "A beautiful invitation, in your chosen template"],
      ["details", "Date, venue, <b>Google Maps</b> and directions"],
      ["gallery", "Photo gallery — memories through the years"],
      ["rsvp", "<b>RSVP in seconds</b> — no app, no login"],
      ["wish", "Guests leave wishes for the family"],
      ["memories", "The <b>memory wall</b> — photos, videos &amp; voice messages"],
    ];
    for (const [id, text] of sections) {
      if (await scrollToId(page, id)) await caption(page, text, 2800);
    }
    await caption(page, "");
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

async function saveLogin() {
  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${config.baseUrl}/login`);
  console.log("Sign in in the browser window (use a DEMO event's admin account). Waiting for /admin…");
  await page.waitForURL(/\/admin(\/|\?|$)/, { timeout: 5 * 60_000 });
  await context.storageState({ path: AUTH_FILE });
  console.log(`Saved session to ${path.relative(process.cwd(), AUTH_FILE)} — now run with --admin.`);
  await browser.close();
}

async function record() {
  if (config.admin && !existsSync(AUTH_FILE)) {
    console.error("--admin needs a saved session first: node record.mjs --login");
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const rawDir = path.join(OUTPUT_DIR, ".raw");
  rmSync(rawDir, { recursive: true, force: true });

  const browser = await chromium.launch({ headless: !config.headed });
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
  // Keep the one-per-visit banners/tours out of the video.
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("em_concierge_dismissed", "1");
    } catch {}
  });

  const page = await context.newPage();
  const started = Date.now();
  await runScenes(page);
  const video = page.video();
  await context.close();
  await browser.close();

  const rawPath = await video.path();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outPath = path.join(OUTPUT_DIR, `everymoment-demo-${config.mobile ? "mobile" : "desktop"}-${stamp}.mp4`);
  try {
    // Trim the blank first second, convert WebM → H.264 MP4 (plays everywhere, uploads to YouTube/WhatsApp).
    execFileSync(
      "ffmpeg",
      ["-y", "-loglevel", "error", "-ss", "1", "-i", rawPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", outPath],
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
