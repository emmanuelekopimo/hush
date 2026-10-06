/* Builds docs/Hush-Documentation.pdf.
 *
 *   npm run build      (once, so next start can serve the app)
 *   npm run docs
 *
 * The script seeds a separate database (hush_docs), starts the app on port
 * 3200 with HUSH_TODAY pinned, takes screenshots with numbered callouts,
 * renders the diagrams, and prints an HTML page to PDF with Chromium.
 */
import "dotenv/config";
import { execSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { DIAGRAMS } from "./diagrams";
import { captureShots, renderSvgs, type Shot } from "./shots";
import { CONTENT, TESTS } from "./content";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs");
const SHOTS = path.join(OUT, "screenshots");
const FIGS = path.join(OUT, "figures");
const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
const DB_URL = process.env.DOCS_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/hush_docs";
const env = { ...process.env, DATABASE_URL: DB_URL, HUSH_TODAY: "2026-10-06", SESSION_SECRET: "docs-session-secret-0123456789abcdef", PORT: String(PORT) };

let shareUrl = "";

const SHOT_LIST: Shot[] = [
  {
    id: "landing", title: "Landing page", path: "/", signedOut: true,
    intro: "The public home page explains what Hush does and sends visitors to the demo.",
    callouts: [
      { selector: ".hero h1", text: "Headline that states the purpose in one line." },
      { selector: ".hero a.btn-primary", text: "Try the demo opens the sign-in page with the demo account filled in." },
      { selector: ".features", text: "Six feature cards: vault, rotation, one-time links, scanner, scrambler and file sealing." },
    ],
  },
  {
    id: "sign-in", title: "Sign in", path: "/sign-in", signedOut: true, fullPage: false,
    intro: "Email and password sign-in. After five failed attempts in 15 minutes the account is locked for the rest of the window.",
    callouts: [
      { selector: "#email", text: "The demo email and password are pre-filled so the presenter only presses Sign in." },
      { selector: "button[type=submit]", text: "Submits a Server Action. Errors appear inline under each field." },
      { selector: ".demo-hint", text: "Reminder of the demo credentials." },
    ],
  },
  {
    id: "dashboard", title: "Overview (dashboard)", path: "/dashboard",
    intro: "The first screen after sign-in summarises the health of the whole vault.",
    callouts: [
      { selector: "nav[aria-label=Main]", text: "Main navigation. On phones it becomes a bottom tab bar." },
      { selector: "[data-testid=health-card]", text: "Health score from 0 to 100 with counts of healthy, due, overdue and expired secrets." },
      { selector: "[data-testid=stat-grid]", text: "Totals, active share links, and values that are reused in more than one place." },
      { selector: "[data-testid=attention-list]", text: "Secrets to rotate first, worst first. Each row opens the secret." },
      { selector: "[data-testid=activity-card]", text: "Latest audit events, including the failed sign-ins from an unknown IP." },
    ],
  },
  {
    id: "projects", title: "Projects", path: "/projects",
    intro: "Each project groups the variables of one application.",
    callouts: [
      { selector: "[data-testid=project-card] >> nth=0", text: "Project card with the number of secrets and environments." },
      { selector: ".bar >> nth=0", text: "Health bar for the project, coloured by score." },
      { selector: ".card:has(#name)", text: "Create a project. Duplicate names are refused with an inline error." },
    ],
  },
  {
    id: "project", title: "Project and its secrets", path: "/projects/1",
    intro: "The main working screen. Values stay masked until revealed, and every reveal is logged.",
    prepare: async (page) => {
      await page.locator('[data-testid=secret-row]:has-text("DATABASE_URL")').getByRole("button", { name: "Reveal value" }).click();
      await page.locator('[data-testid=secret-row]:has-text("DATABASE_URL") [data-testid=secret-value]').filter({ hasText: "postgres://" }).waitFor();
    },
    callouts: [
      { selector: "nav[aria-label=Environments]", text: "Environment tabs with the number of variables in each." },
      { selector: 'a:has-text("Export .env")', text: "Downloads the environment as a .env file. The export is logged." },
      { selector: '[data-testid=secret-row]:has-text("DATABASE_URL") [data-testid=secret-value]', text: "A revealed value. Eye hides it again; the copy button copies without showing it." },
      { selector: ".badge.info", text: "Reused: the same value is stored under another key, here production and staging." },
      { selector: ".badge.expired", text: "Rotation status with a plain explanation underneath." },
      { selector: "[data-testid=secret-form]", text: "Add a secret. The value is encrypted before it is saved." },
      { selector: "[data-testid=env-diff]", text: "Keys that exist in one environment but not the other." },
    ],
  },
  {
    id: "secret", title: "Rotate or edit a secret", path: "/projects/2/secrets/14",
    intro: "Opening a secret shows its rotation history and lets you save a new value.",
    callouts: [
      { selector: "[data-testid=edit-form] textarea", text: "A new value counts as a rotation: version goes up and the clock restarts today." },
      { selector: ".list.small", text: "Status, version, last rotation, next rotation and expiry." },
      { selector: 'a:has-text("Share once")', text: "Opens Share links with this secret already selected." },
      { selector: 'button:has-text("Delete secret")', text: "Deletes the secret. The deletion is logged." },
    ],
  },
  {
    id: "shares", title: "Share links", path: "/shares",
    intro: "One-time links for sending a secret to a teammate without pasting it into a chat.",
    prepare: async (page: Page) => {
      await page.getByLabel("Secret").selectOption({ label: "Campus Pay API / staging / DATABASE_URL" });
      await page.getByRole("button", { name: "Create link" }).click();
      shareUrl = await page.getByTestId("share-url").innerText();
    },
    callouts: [
      { selector: ".share-url", text: "The new link is shown once. Hush stores only its SHA-256 hash." },
      { selector: "[data-testid=share-form] .form-row", text: "Expiry (1 hour to 7 days) and how many times it can be opened." },
      { selector: "[data-testid=share-list]", text: "Every link with its state: active, used, expired or revoked." },
      { selector: 'button:has-text("Revoke") >> nth=0', text: "Revoke stops an active link and deletes its stored value." },
    ],
  },
  {
    id: "share-open", title: "Opening a shared link", path: "/", signedOut: true, fullPage: false,
    intro: "What the recipient sees. Opening the page does not use a view, so link previews in chat apps cannot burn it.",
    prepare: async (page) => { await page.goto(shareUrl); },
    callouts: [
      { selector: "h1", text: "Who sent it is not shown. The label, time left and views left are." },
      { selector: 'button:has-text("Reveal secret")', text: "Only this button uses a view." },
    ],
  },
  {
    id: "share-revealed", title: "Shared value revealed", path: "/", signedOut: true, fullPage: false,
    intro: "After Reveal the value is shown once with a copy button, and the server deletes its copy.",
    prepare: async (page) => {
      await page.goto(shareUrl);
      await page.getByRole("button", { name: "Reveal secret" }).click();
      await page.getByTestId("shared-value").waitFor();
    },
    callouts: [
      { selector: "[data-testid=shared-value]", text: "The decrypted value with a copy button." },
      { selector: ".notice", text: "Tells the recipient the link is now used up." },
    ],
  },
  {
    id: "scanner", title: "Leak scanner", path: "/scanner",
    intro: "Finds credentials in pasted code or logs. It runs in the browser, so the text is never uploaded.",
    prepare: async (page) => { await page.getByRole("button", { name: "Load a leaky sample" }).click(); },
    callouts: [
      { selector: "textarea", text: "Sample code with a payment key, an AWS key, a database URL and tokens." },
      { selector: "[data-testid=scan-summary]", text: "Summary by severity." },
      { selector: "[data-testid=finding] >> nth=0", text: "Each finding shows the rule, a redacted match, the line and column, and what to do." },
    ],
  },
  {
    id: "scramble-before", title: "Image scrambler: original", path: "/tools?tool=scramble",
    intro: "A sample student ID card is drawn on the canvas so the demo works without uploading a photo.",
    callouts: [
      { selector: "[data-testid=scramble-canvas]", text: "The image. Choose an image replaces it with your own file." },
      { selector: "#scramble-key", text: "The key. Anyone who knows it can reverse the scramble." },
      { selector: "#block", text: "Block size: smaller blocks hide more detail." },
    ],
  },
  {
    id: "scramble-after", title: "Image scrambler: scrambled", path: "/tools?tool=scramble",
    intro: "After Scramble the card is unreadable. Unscramble with the same key restores every pixel exactly.",
    prepare: async (page) => {
      await page.getByRole("button", { name: "Scramble", exact: true }).click();
      await page.locator('[data-state="scrambled"]').waitFor();
    },
    callouts: [
      { selector: "[data-testid=scramble-canvas]", text: "Blocks shuffled and colours masked." },
      { selector: 'button:has-text("Unscramble")', text: "Reverses it. A wrong key leaves noise." },
      { selector: 'button:has-text("PNG")', text: "Download as PNG (lossless) so it can be restored later." },
    ],
  },
  {
    id: "seal", title: "Seal a file", path: "/tools?tool=seal",
    intro: "Encrypts any file with a passphrase in the browser and downloads a .hush file.",
    callouts: [
      { selector: ".drop", text: "Pick any file, or a .hush file to unseal. The type is detected from its first bytes." },
      { selector: "#pass", text: "Passphrase, at least 8 characters. PBKDF2 turns it into an AES key." },
      { selector: '.card:has-text("How a sealed file is built")', text: "The file format, explained for the audience." },
    ],
  },
  {
    id: "generator", title: "Secret generator", path: "/tools?tool=generate",
    intro: "Generates strong random values for new secrets.",
    prepare: async (page) => { await page.getByRole("button", { name: "Generate" }).click(); },
    callouts: [
      { selector: "#len", text: "Length and character set." },
      { selector: '.badge:has-text("bits")', text: "Entropy in bits and a strength label." },
      { selector: "[data-testid=generated]", text: "The generated value with a copy button." },
    ],
  },
  {
    id: "activity", title: "Activity log", path: "/activity",
    intro: "A record of every security-relevant action, filtered by type.",
    callouts: [
      { selector: "nav[aria-label=Filter]", text: "Filter by sign-ins, secrets, share links or import and export." },
      { selector: ".notice.bad", text: "Failed and blocked sign-ins are highlighted." },
      { selector: "[data-testid=activity-table] tbody tr >> nth=0", text: "Each event shows what happened, the target, the IP address and the time." },
    ],
  },
  {
    id: "mobile-dashboard", title: "Mobile: overview", path: "/dashboard", mobile: true, fullPage: false,
    intro: "On a phone the sidebar becomes a top bar and a bottom tab bar.",
    callouts: [
      { selector: ".topbar", text: "Top bar with activity, sign out and avatar." },
      { selector: "[data-testid=health-card]", text: "Cards stack in one column." },
      { selector: "nav[aria-label=Mobile]", text: "Bottom tab bar within thumb reach." },
    ],
  },
  {
    id: "mobile-project", title: "Mobile: project", path: "/projects/1", mobile: true, fullPage: false,
    intro: "Table rows turn into stacked cards so nothing scrolls sideways.",
    callouts: [
      { selector: "nav[aria-label=Environments]", text: "Environment tabs." },
      { selector: "[data-testid=secret-row] >> nth=0", text: "Each secret as a card: key, masked value, reveal and copy, status." },
    ],
  },
];

async function waitForHealth(url: string, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("App did not start");
}

function dataUri(file: string, type: string) {
  return `data:${type};base64,${readFileSync(file).toString("base64")}`;
}

function fontCss() {
  const inter = dataUri(path.join(ROOT, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"), "font/woff2");
  const mono = dataUri(path.join(ROOT, "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2"), "font/woff2");
  return `@font-face{font-family:"Inter Variable";src:url(${inter}) format("woff2");font-weight:100 900;}
@font-face{font-family:"JetBrains Mono";src:url(${mono}) format("woff2");font-weight:400;}`;
}

function img(file: string) {
  return dataUri(file, "image/png");
}

function shotSection(shot: Shot, n: number) {
  return `<section class="shot">
  <h3>${n}. ${shot.title}</h3>
  <p>${shot.intro}</p>
  <figure class="${shot.mobile ? "phone" : ""}"><img src="${img(path.join(SHOTS, `${shot.id}.png`))}" alt="${shot.title}"/></figure>
  <ol class="callouts">${shot.callouts.map((c) => `<li>${c.text}</li>`).join("")}</ol>
</section>`;
}

function buildHtml() {
  const fig = (name: string, caption: string) =>
    `<figure class="diagram"><img src="${img(path.join(FIGS, `${name}.png`))}" alt="${caption}"/><figcaption>${caption}</figcaption></figure>`;
  const walkthrough = SHOT_LIST.filter((s) => !s.mobile).map((s, i) => shotSection(s, i + 1)).join("\n");
  const mobile = SHOT_LIST.filter((s) => s.mobile);
  const C = CONTENT;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Hush Documentation</title>
<style>
${fontCss()}
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Inter Variable", sans-serif; color: #111; font-size: 10.5pt; line-height: 1.55; margin: 0; }
h1 { font-size: 22pt; letter-spacing: -0.02em; margin: 0 0 10px; }
h2 { font-size: 16pt; margin: 0 0 10px; padding-top: 4px; letter-spacing: -0.01em; page-break-after: avoid; }
h3 { font-size: 12.5pt; margin: 18px 0 6px; page-break-after: avoid; }
p { margin: 0 0 8px; }
code, pre { font-family: "JetBrains Mono", monospace; font-size: 8.8pt; }
pre { background: #f4f4f4; border: 1px solid #e2e2e2; border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; page-break-inside: avoid; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; page-break-inside: avoid; font-size: 9.5pt; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
th { background: #111; color: #fff; font-weight: 600; }
.chapter { page-break-before: always; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 14px; }
.cover img.logo { width: 76px; background: #000; border-radius: 22px; padding: 6px; }
.cover h1 { font-size: 40pt; margin: 0; }
.cover .sub { font-size: 14pt; color: #444; max-width: 140mm; }
.cover .meta { margin-top: 30px; font-size: 10pt; color: #555; line-height: 1.8; }
.toc li { margin: 3px 0; }
figure { margin: 10px 0; text-align: center; page-break-inside: avoid; }
figure img { max-width: 100%; border: 1px solid #ddd; border-radius: 8px; }
figure.phone img { max-height: 118mm; }
figure.diagram img { border: none; }
figcaption { font-size: 9pt; color: #555; margin-top: 4px; }
.shot { page-break-inside: avoid; margin-bottom: 14px; }
.shot figure img { max-height: 175mm; }
ol.callouts { counter-reset: c; list-style: none; padding: 0; margin: 6px 0 0; }
ol.callouts li { counter-increment: c; position: relative; padding-left: 30px; margin: 4px 0; }
ol.callouts li::before { content: counter(c); position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; background: #ff6a00; color: #fff; font-weight: 700; font-size: 9pt; text-align: center; line-height: 20px; }
.phones { display: flex; gap: 18px; justify-content: center; }
.phones figure { flex: 1; }
.note { background: #f6f6f6; border-left: 3px solid #111; padding: 8px 12px; margin: 10px 0; }
.script td:first-child { width: 70px; font-weight: 600; white-space: nowrap; }
</style></head><body>

<section class="cover">
  <img class="logo" src="${dataUri(path.join(ROOT, "public/logo.svg"), "image/svg+xml")}" alt=""/>
  <h1>Hush</h1>
  <div class="sub">A simple env manager and vault for project secrets. Project documentation and presentation guide.</div>
  <div class="meta">
    Friday Godswill Essien (23/SC/CO/158)<br/>
    Department of Computer Science, University of Uyo<br/>
    300 level project, ${C.dateLabel}<br/>
    Live: ${C.liveUrl}<br/>
    Demo login: demo@hush.ng / demo1234
  </div>
</section>

<section class="chapter">
  <h2>Contents</h2>
  <ol class="toc">
    <li>Overview</li><li>How the core logic works</li><li>Architecture and data model</li><li>Walkthrough of every screen</li>
    <li>Mobile view</li><li>Running locally</li><li>Testing</li><li>Deployment</li><li>Five-minute presentation script</li>
  </ol>
  <h2 style="margin-top:24px">1. Overview</h2>
  ${C.overview}
</section>

<section class="chapter">
  <h2>2. How the core logic works</h2>
  ${C.logic}
  ${fig("encryptionFlow", "Figure 1. How a secret value is encrypted before it is stored")}
  ${fig("rotationFlow", "Figure 2. How the rotation status of a secret is decided")}
  ${C.logic2}
  ${fig("shareSequence", "Figure 3. Creating and opening a one-time share link")}
  ${C.logic3}
  ${fig("scrambleFlow", "Figure 4. Image scrambling with a key")}
</section>

<section class="chapter">
  <h2>3. Architecture and data model</h2>
  ${C.architecture}
  ${fig("architecture", "Figure 5. System architecture")}
  ${C.dataModel}
  ${fig("erd", "Figure 6. Entity relationship diagram")}
</section>

<section class="chapter">
  <h2>4. Walkthrough of every screen</h2>
  <p>Numbered orange markers on each screenshot match the numbered notes under it. Screenshots were taken from the seeded demo data with the date pinned to ${C.dateLabel}.</p>
  ${walkthrough}
</section>

<section class="chapter">
  <h2>5. Mobile view</h2>
  <p>Every page works at phone width with no sideways scrolling. CSS grids use minmax(0, 1fr) so long keys and values wrap instead of widening the page. An automated test checks eight pages on a Pixel 7 screen size.</p>
  <div class="phones">${mobile.map((m) => `<figure class="phone"><img src="${img(path.join(SHOTS, `${m.id}.png`))}" alt="${m.title}"/><figcaption>${m.title}</figcaption></figure>`).join("")}</div>
  ${mobile.map((m) => `<h3>${m.title}</h3><p>${m.intro}</p><ol class="callouts">${m.callouts.map((c) => `<li>${c.text}</li>`).join("")}</ol>`).join("")}
</section>

<section class="chapter">
  <h2>6. Running locally</h2>
  ${C.local}
</section>

<section class="chapter">
  <h2>7. Testing</h2>
  ${C.testing}
</section>

<section class="chapter">
  <h2>8. Deployment</h2>
  ${C.deployment}
  ${fig("deployment", "Figure 7. Deployment pipeline")}
</section>

<section class="chapter">
  <h2>9. Five-minute presentation script</h2>
  ${C.script}
</section>
</body></html>`;
}

async function main() {
  const skipShots = process.argv.includes("--no-shots");
  mkdirSync(OUT, { recursive: true });

  console.log("Rendering diagrams");
  const svgs = Object.fromEntries(Object.entries(DIAGRAMS).map(([k, f]) => [k, f()]));
  await renderSvgs(Object.fromEntries(Object.entries(svgs).map(([k, v]) => [k, `<style>${fontCss()}</style>${v}`])), FIGS);

  if (!skipShots) {
    console.log("Seeding docs database");
    execSync("npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts", { stdio: "inherit", env });
    console.log("Starting app");
    const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
    try {
      await waitForHealth(`${BASE}/api/health`);
      await captureShots(BASE, SHOT_LIST, SHOTS);
    } finally {
      if (server.pid) {
        try {
          process.kill(-server.pid, "SIGTERM");
        } catch {
          server.kill("SIGTERM");
        }
      }
    }
  }

  console.log("Printing PDF");
  const html = buildHtml();
  writeFileSync(path.join(os.tmpdir(), "Hush-Documentation.html"), html);
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.join(OUT, "Hush-Documentation.pdf"),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-size:8px;color:#888;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>Hush documentation</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" },
  });
  await browser.close();
  console.log(`Done: docs/Hush-Documentation.pdf (${TESTS.total} tests documented)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
