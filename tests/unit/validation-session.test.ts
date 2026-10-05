import { describe, expect, it } from "vitest";
import { fieldErrors, projectSchema, secretSchema, shareSchema, signUpSchema } from "@/lib/validation";
import { signSession, verifySession } from "@/lib/session";

describe("validation", () => {
  it("accepts a good secret and upper-cases the key", () => {
    const r = secretSchema.parse({ key: "api_key", value: "x", environment: "staging", rotationDays: "30", expiresOn: "" });
    expect(r).toMatchObject({ key: "API_KEY", rotationDays: 30, expiresOn: null, note: "" });
  });
  it("returns one message per field", () => {
    const r = secretSchema.safeParse({ key: "9 bad", value: "", environment: "prod", rotationDays: "0", expiresOn: "2026-02-31" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(fieldErrors(r.error)).toEqual({
        key: "Use letters, numbers and underscores, starting with a letter",
        value: "Enter a value",
        environment: "Pick an environment",
        rotationDays: "At least 1 day",
        expiresOn: "Use a valid date",
      });
    }
  });
  it("checks sign-up passwords", () => {
    expect(signUpSchema.safeParse({ name: "Ada", email: "ada@x.ng", password: "password" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "Ada", email: "ada@x.ng", password: "passw0rd" }).success).toBe(true);
  });
  it("checks projects and shares", () => {
    expect(projectSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(shareSchema.safeParse({ secretId: "3", expiry: "24h", maxViews: "1" }).success).toBe(true);
    expect(shareSchema.safeParse({ secretId: "3", expiry: "2y", maxViews: "1" }).success).toBe(false);
  });
});

describe("session tokens", () => {
  const secret = "session-unit-secret-0123456789";
  it("signs and verifies", async () => {
    const t = await signSession({ uid: 7, name: "Ada" }, secret);
    expect(await verifySession(t, secret)).toEqual({ uid: 7, name: "Ada" });
  });
  it("rejects a token signed with another secret, a tampered token or an expired one", async () => {
    const t = await signSession({ uid: 7, name: "Ada" }, secret);
    expect(await verifySession(t, "different-secret-0123456789")).toBeNull();
    expect(await verifySession(t.slice(0, -2) + "xx", secret)).toBeNull();
    const old = await signSession({ uid: 7, name: "Ada" }, secret, new Date("2020-01-01"));
    expect(await verifySession(old, secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });
});
