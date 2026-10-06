import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("demo login is pre-filled and opens the dashboard", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email")).toHaveValue("demo@hush.ng");
  await expect(page.getByLabel("Password")).toHaveValue("demo1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Friday");
  await expect(page.getByTestId("health-card")).toContainText("Vault health");
  await expect(page.getByTestId("attention-list")).toContainText("SMTP_PASSWORD");
});

test("sign-in shows inline and form errors", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await page.getByLabel("Email").fill("demo@hush.ng");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
});

test("private pages redirect to sign-in", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fprojects/);
});

test("sign up validates and creates an empty vault", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("A");
  await page.getByLabel("Email").fill("bad");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  await page.getByLabel("Full name").fill("Emem Udo");
  await page.getByLabel("Email").fill(`emem${Date.now()}@hush.ng`);
  await page.getByLabel("Password").fill("passw0rd1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Emem");
  await expect(page.getByText("Nothing needs attention")).toBeVisible();
});

test("sign out ends the session", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});
