import { expect, test } from "@playwright/test";
import { noHorizontalScroll, signIn } from "./helpers";

test("pages fit a phone screen with no sideways scrolling", async ({ page }) => {
  await signIn(page);
  for (const path of ["/dashboard", "/projects", "/projects/1", "/projects/1/secrets/2", "/shares", "/scanner", "/tools", "/activity"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await noHorizontalScroll(page);
  }
});

test("bottom navigation and revealing a secret on mobile", async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole("navigation", { name: "Mobile" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.getByTestId("project-card").filter({ hasText: "Campus Pay API" }).click();
  const row = page.getByTestId("secret-row").filter({ hasText: "REDIS_URL" });
  await row.getByRole("button", { name: "Reveal value" }).click();
  await expect(row.getByTestId("secret-value")).toContainText("redis://");
  await noHorizontalScroll(page);
});
