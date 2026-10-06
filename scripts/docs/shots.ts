import { chromium, devices, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

export interface Callout {
  selector: string;
  text: string;
}

export interface Shot {
  id: string;
  title: string;
  path: string;
  intro: string;
  callouts: Callout[];
  mobile?: boolean;
  signedOut?: boolean;
  fullPage?: boolean;
  prepare?: (page: Page) => Promise<void>;
}

async function signIn(page: Page, base: string) {
  await page.goto(`${base}/sign-in`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function addCallouts(page: Page, callouts: Callout[]) {
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const c of callouts) {
    const loc = page.locator(c.selector).first();
    await loc.scrollIntoViewIfNeeded().catch(() => undefined);
    const b = await loc.boundingBox();
    if (!b) throw new Error(`Callout target not found: ${c.selector}`);
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    boxes.push({ x: b.x + scroll.x, y: b.y + scroll.y, w: b.width, h: b.height });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate((boxes) => {
    boxes.forEach((b, i) => {
      const ring = document.createElement("div");
      ring.className = "doc-callout";
      Object.assign(ring.style, {
        position: "absolute", left: `${b.x - 4}px`, top: `${b.y - 4}px`, width: `${b.w + 8}px`, height: `${b.h + 8}px`,
        border: "2px solid #ff6a00", borderRadius: "12px", zIndex: "9998", pointerEvents: "none", boxShadow: "0 0 0 3px rgba(255,106,0,.18)",
      });
      const badge = document.createElement("div");
      badge.className = "doc-callout";
      badge.textContent = String(i + 1);
      const left = Math.max(2, b.x - 16);
      const top = Math.max(2, b.y - 16);
      Object.assign(badge.style, {
        position: "absolute", left: `${left}px`, top: `${top}px`, width: "28px", height: "28px", borderRadius: "50%",
        background: "#ff6a00", color: "#fff", font: "700 15px/28px Inter Variable, sans-serif", textAlign: "center",
        zIndex: "9999", border: "2px solid #fff", pointerEvents: "none",
      });
      document.body.appendChild(ring);
      document.body.appendChild(badge);
    });
    document.body.style.position = "relative";
  }, boxes);
}

export async function captureShots(base: string, shots: Shot[], outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const desktop = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 });
  const mobile = await browser.newContext({ ...devices["Pixel 7"], deviceScaleFactor: 2 });
  const guest = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 });
  await signIn(await desktop.newPage(), base);
  await signIn(await mobile.newPage(), base);

  for (const shot of shots) {
    const ctx = shot.signedOut ? guest : shot.mobile ? mobile : desktop;
    const page = await ctx.newPage();
    await page.goto(base + shot.path);
    await page.waitForLoadState("networkidle");
    if (shot.prepare) await shot.prepare(page);
    await page.evaluate(() => document.fonts.ready);
    await addCallouts(page, shot.callouts);
    await page.screenshot({ path: `${outDir}/${shot.id}.png`, fullPage: shot.fullPage ?? true });
    await page.close();
    console.log(`  shot ${shot.id}`);
  }
  await browser.close();
}

export async function renderSvgs(svgs: Record<string, string>, outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const [name, markup] of Object.entries(svgs)) {
    await page.setContent(`<html><body style="margin:0">${markup}</body></html>`);
    await page.locator("svg").screenshot({ path: `${outDir}/${name}.png` });
  }
  await browser.close();
}
