import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => signIn(page));

async function openProject(page: import("@playwright/test").Page, name: string) {
  await page.goto("/projects");
  await page.getByTestId("project-card").filter({ hasText: name }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

test("project page shows statuses and switches environments", async ({ page }) => {
  await openProject(page, "Campus Pay API");
  const table = page.getByTestId("secret-table");
  await expect(table.getByTestId("secret-row").filter({ hasText: "SMTP_PASSWORD" })).toContainText("Expired");
  await expect(table.getByTestId("secret-row").filter({ hasText: "PAYSTACK_SECRET_KEY" })).toContainText("Overdue");
  await expect(table.getByTestId("secret-row").filter({ hasText: "JWT_SECRET" })).toContainText("Reused");
  await page.getByRole("link", { name: /staging/ }).click();
  await expect(page.getByRole("heading", { name: "Variables in staging" })).toBeVisible();
  await expect(page.getByTestId("env-diff")).toContainText("Missing in staging");
});

test("revealing a secret shows the value and is logged", async ({ page }) => {
  await openProject(page, "Campus Pay API");
  const row = page.getByTestId("secret-row").filter({ hasText: "DATABASE_URL" });
  await row.getByRole("button", { name: "Reveal value" }).click();
  await expect(row.getByTestId("secret-value")).toContainText("postgres://campuspay:");
  await page.goto("/activity?type=secret");
  await expect(page.getByTestId("activity-table")).toContainText("Revealed secret");
});

test("adding a secret validates inline and then saves", async ({ page }) => {
  await openProject(page, "Portfolio Site");
  const form = page.getByTestId("secret-form");
  await form.getByLabel("Key").fill("1bad key");
  await form.getByRole("button", { name: "Save secret" }).click();
  await expect(form.getByText("Use letters, numbers and underscores")).toBeVisible();
  await expect(form.getByText("Enter a value")).toBeVisible();
  await form.getByLabel("Key").fill("analytics_id");
  await form.getByLabel("Value").fill("G-12345ABC");
  await form.getByLabel("Rotate every (days)").fill("180");
  await form.getByRole("button", { name: "Save secret" }).click();
  await expect(form.getByText("ANALYTICS_ID saved to production")).toBeVisible();
  await expect(page.getByTestId("secret-row").filter({ hasText: "ANALYTICS_ID" })).toContainText("Healthy");
});

test("rotating an overdue secret makes it healthy", async ({ page }) => {
  await openProject(page, "Hostel Finder");
  await page.getByRole("link", { name: "Edit ADMIN_PASSWORD" }).click();
  await expect(page.getByText("Overdue")).toBeVisible();
  await page.getByTestId("edit-form").getByLabel(/New value/).fill("n3w-Admin-Passw0rd-2026");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("New value saved. Rotation clock restarted.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Healthy")).toBeVisible();
  await expect(page.getByText("v3")).toBeVisible();
});

test("importing a .env file and exporting it again", async ({ page }) => {
  await openProject(page, "Hostel Finder");
  await page.getByText("Import a .env file").click();
  const form = page.getByTestId("import-form");
  await form.getByLabel("Import into").selectOption("staging");
  await form.getByLabel(".env contents").fill("# staging\nAPI_URL=https://staging.hostelfinder.ng\nSENTRY_DSN=\"https://key@sentry.io/42\"\nbroken line");
  await form.getByRole("button", { name: "Import variables" }).click();
  await expect(form.getByText("Line 4: Missing = sign")).toBeVisible();
  await form.getByLabel(".env contents").fill("API_URL=https://staging.hostelfinder.ng\nSENTRY_DSN=\"https://key@sentry.io/42\"");
  await form.getByRole("button", { name: "Import variables" }).click();
  await expect(form.getByText("2 added, 0 updated, 0 skipped")).toBeVisible();
  await page.getByRole("link", { name: /staging/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export .env" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("hostel-finder.staging.env");
  const text = readFileSync((await file.path())!, "utf8");
  expect(text).toContain("API_URL=https://staging.hostelfinder.ng");
  expect(text).toContain("SENTRY_DSN=https://key@sentry.io/42");
});

test("another user's project is not found", async ({ page }) => {
  const res = await page.goto("/projects/4");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("health check reports the database", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(await res.json()).toMatchObject({ status: "ok", database: "ok" });
});
