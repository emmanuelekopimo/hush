import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => signIn(page));

test("a one-time share link opens once", async ({ page, browser }) => {
  await page.goto("/shares");
  await expect(page.getByTestId("share-list")).toContainText("Used");
  const form = page.getByTestId("share-form");
  await form.getByLabel("Secret").selectOption({ label: "Campus Pay API / production / REDIS_URL" });
  await form.getByRole("button", { name: "Create link" }).click();
  const url = await page.getByTestId("share-url").innerText();
  expect(url).toMatch(/\/s\/[A-Za-z0-9_-]{32}$/);

  const guest = await browser.newContext();
  const g = await guest.newPage();
  await g.goto(url);
  await expect(g.getByText("Someone shared a secret with you")).toBeVisible();
  await g.getByRole("button", { name: "Reveal secret" }).click();
  await expect(g.getByTestId("shared-value")).toContainText("redis://default:");
  await g.goto(url);
  await expect(g.getByTestId("share-unavailable")).toContainText("already been opened");
  await guest.close();

  await page.goto("/activity?type=share");
  await expect(page.getByTestId("activity-table")).toContainText("Share link opened");
});

test("leak scanner finds secrets in the sample", async ({ page }) => {
  await page.goto("/scanner");
  await page.getByRole("button", { name: "Load a leaky sample" }).click();
  await expect(page.getByTestId("scan-summary")).toContainText("possible secrets found");
  await expect(page.getByTestId("finding").filter({ hasText: "AWS access key ID" })).toBeVisible();
  await page.getByLabel("Text to scan").fill("const key = process.env.API_KEY;");
  await page.getByRole("button", { name: "Scan for secrets" }).click();
  await expect(page.getByText("No secrets found.")).toBeVisible();
});

test("image scrambler restores only with the right key", async ({ page }) => {
  await page.goto("/tools?tool=scramble");
  const canvas = page.getByTestId("scramble-canvas");
  const hash = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  const original = await hash();
  await page.getByRole("button", { name: "Scramble", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-state", "scrambled");
  const scrambled = await hash();
  expect(scrambled).not.toBe(original);
  await page.getByLabel("Key").fill("wrong-key");
  await page.getByRole("button", { name: "Unscramble", exact: true }).click();
  expect(await hash()).not.toBe(original);
  await page.getByRole("button", { name: "Scramble", exact: true }).click(); // undo the wrong attempt
  expect(await hash()).toBe(scrambled);
  await page.getByLabel("Key").fill("uniuyo-2026");
  await page.getByRole("button", { name: "Unscramble", exact: true }).click();
  expect(await hash()).toBe(original);
});

test("sealing and unsealing a file in the browser", async ({ page }) => {
  await page.goto("/tools?tool=seal");
  await page.getByTestId("seal-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("matric 23/SC/CO/158") });
  await page.getByLabel("Passphrase").fill("correct horse battery");
  const d1 = page.waitForEvent("download");
  await page.getByRole("button", { name: "Seal and download" }).click();
  const sealed = await d1;
  expect(sealed.suggestedFilename()).toBe("notes.txt.hush");
  const bytes = readFileSync((await sealed.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("HUSH1");

  await page.getByTestId("seal-input").setInputFiles({ name: "notes.txt.hush", mimeType: "application/octet-stream", buffer: bytes });
  await expect(page.getByText("Sealed Hush file detected")).toBeVisible();
  await page.getByLabel("Passphrase").fill("wrong passphrase");
  await page.getByRole("button", { name: "Unseal and download" }).click();
  await expect(page.getByText("Wrong passphrase or the file was changed")).toBeVisible();
  await page.getByLabel("Passphrase").fill("correct horse battery");
  const d2 = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unseal and download" }).click();
  const plain = await d2;
  expect(plain.suggestedFilename()).toBe("notes.txt");
  expect(readFileSync((await plain.path())!, "utf8")).toBe("matric 23/SC/CO/158");
});

test("generator makes strong secrets", async ({ page }) => {
  await page.goto("/tools?tool=generate");
  await page.getByLabel("Length").fill("48");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByTestId("generated")).toHaveText(/^[A-Za-z0-9]{48}$/);
  await expect(page.getByText("Very strong")).toBeVisible();
});
