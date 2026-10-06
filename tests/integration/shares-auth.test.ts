import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import type { DB } from "@/db";
import { shareLinks } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { listEvents } from "@/server/audit";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/server/seed";
import { createShare, listShares, openShare, peekShare, revokeShare } from "@/server/shares";
import { authenticate, createUser } from "@/server/users";
import { freshSeed, NOW, setupDb, vault } from "./helpers";

let db: DB;
let pool: Pool;
let ids: Awaited<ReturnType<typeof freshSeed>>;

beforeAll(async () => ({ db, pool } = await setupDb()));
afterAll(async () => pool.end());
beforeEach(async () => (ids = await freshSeed(db)));

describe("share links", () => {
  it("seeds one link in each state", async () => {
    const statuses = (await listShares(db, ids.demoId, NOW)).map((s) => s.status).sort();
    expect(statuses).toEqual(["active", "expired", "revoked", "used"]);
  });
  it("opens a one-time link exactly once and then burns the value", async () => {
    const sid = ids.secretIds["Campus Pay API/production/JWT_SECRET"];
    const res = await createShare(db, ids.demoId, { secretId: sid, expiry: "24h", maxViews: 1 }, vault, NOW);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [row] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, sha256(res.token)));
    expect(row.ciphertext).not.toContain(res.token);
    expect((await peekShare(db, res.token, NOW))?.status).toBe("active");

    const first = await openShare(db, res.token, NOW);
    expect(first).toMatchObject({ ok: true, key: "JWT_SECRET", viewsLeft: 0 });
    const second = await openShare(db, res.token, NOW);
    expect(second).toEqual({ ok: false, status: "used" });
    const [burned] = await db.select().from(shareLinks).where(eq(shareLinks.id, row.id));
    expect(burned.ciphertext).toBeNull();
  });
  it("lets only one of two simultaneous opens succeed", async () => {
    const sid = ids.secretIds["Hostel Finder/production/MAPBOX_TOKEN"];
    const res = await createShare(db, ids.demoId, { secretId: sid, expiry: "1h", maxViews: 1 }, vault, NOW);
    if (!res.ok) throw new Error("share failed");
    const results = await Promise.all([openShare(db, res.token, NOW), openShare(db, res.token, NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
  it("refuses expired, revoked and unknown links", async () => {
    const sid = ids.secretIds["Portfolio Site/production/RESEND_API_KEY"];
    const res = await createShare(db, ids.demoId, { secretId: sid, expiry: "1h", maxViews: 3 }, vault, NOW);
    if (!res.ok) throw new Error("share failed");
    const afterExpiry = new Date(NOW.getTime() + 2 * 3_600_000);
    expect(await openShare(db, res.token, afterExpiry)).toEqual({ ok: false, status: "expired" });
    expect(await revokeShare(db, ids.otherId, res.link.id, NOW)).toBe(false);
    expect(await revokeShare(db, ids.demoId, res.link.id, NOW)).toBe(true);
    expect(await openShare(db, res.token, NOW)).toEqual({ ok: false, status: "revoked" });
    expect(await openShare(db, "not-a-real-token", NOW)).toEqual({ ok: false, status: "missing" });
  });
  it("cannot share another user's secret", async () => {
    const sid = ids.secretIds["Campus Pay API/production/JWT_SECRET"];
    const res = await createShare(db, ids.otherId, { secretId: sid, expiry: "1h", maxViews: 1 }, vault, NOW);
    expect(res.ok).toBe(false);
  });
});

describe("authentication", () => {
  it("signs in the demo user and records it", async () => {
    const r = await authenticate(db, DEMO_EMAIL, DEMO_PASSWORD, NOW, "1.2.3.4");
    expect(r.ok).toBe(true);
    const [e] = await listEvents(db, ids.demoId, { limit: 1 });
    expect(e).toMatchObject({ action: "auth.sign_in", ip: "1.2.3.4" });
  });
  it("locks the account after five failed attempts, even with the right password", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await authenticate(db, DEMO_EMAIL, "wrong", new Date(NOW.getTime() + i * 1000))).toEqual({ ok: false, reason: "invalid" });
    }
    const locked = await authenticate(db, DEMO_EMAIL, DEMO_PASSWORD, new Date(NOW.getTime() + 10_000));
    expect(locked).toMatchObject({ ok: false, reason: "locked" });
    const later = await authenticate(db, DEMO_EMAIL, DEMO_PASSWORD, new Date(NOW.getTime() + 16 * 60_000));
    expect(later.ok).toBe(true);
  });
  it("creates accounts and refuses duplicate emails", async () => {
    const r = await createUser(db, { name: "New User", email: "New@Hush.ng", password: "passw0rd" });
    expect(r.ok).toBe(true);
    expect((await createUser(db, { name: "Again", email: "new@hush.ng", password: "passw0rd" })).ok).toBe(false);
    expect((await authenticate(db, "new@hush.ng", "passw0rd", NOW)).ok).toBe(true);
  });
});
