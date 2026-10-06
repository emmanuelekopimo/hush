import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Pool } from "pg";
import type { DB } from "@/db";
import { secrets } from "@/db/schema";
import { decrypt, secretAad } from "@/lib/crypto";
import { listEvents } from "@/server/audit";
import { isEmpty } from "@/server/seed";
import {
  attentionList, createProject, createSecret, deleteProject, exportEntries, getProject, getSecret,
  importEntries, listProjects, listSecrets, overallHealth, revealSecret, updateSecret,
} from "@/server/vault";
import { freshSeed, setupDb, TODAY, vault } from "./helpers";

let db: DB;
let pool: Pool;
let ids: Awaited<ReturnType<typeof freshSeed>>;

beforeAll(async () => ({ db, pool } = await setupDb()));
afterAll(async () => pool.end());
beforeEach(async () => (ids = await freshSeed(db)));

describe("seed data", () => {
  it("creates a demo vault with good and problem cases", async () => {
    expect(await isEmpty(db)).toBe(false);
    const projects = await listProjects(db, ids.demoId, TODAY);
    expect(projects.map((p) => p.name)).toEqual(["Campus Pay API", "Hostel Finder", "Portfolio Site"]);
    const health = await overallHealth(db, ids.demoId, TODAY);
    expect(health).toMatchObject({ total: 17, expired: 1, overdue: 2, due: 3 });
    const attention = await attentionList(db, ids.demoId, vault, TODAY);
    expect(attention[0].rotation.status).toBe("expired");
    expect(attention[0].key).toBe("SMTP_PASSWORD");
  });
  it("stores only ciphertext in the database", async () => {
    const rows = await db.select().from(secrets).where(eq(secrets.userId, ids.demoId));
    for (const r of rows) {
      expect(r.ciphertext.startsWith("v1.")).toBe(true);
      expect(r.ciphertext).not.toContain("postgres://");
    }
  });
});

describe("user scoping", () => {
  it("never returns another user's projects or secrets", async () => {
    const adaProjects = await listProjects(db, ids.otherId, TODAY);
    expect(adaProjects).toHaveLength(1);
    const campus = ids.projectIds["Campus Pay API"];
    expect(await getProject(db, ids.otherId, campus)).toBeNull();
    expect(await listSecrets(db, ids.otherId, campus, "production", vault, TODAY)).toEqual([]);
    const sid = ids.secretIds["Campus Pay API/production/JWT_SECRET"];
    expect(await getSecret(db, ids.otherId, sid)).toBeNull();
    expect(await revealSecret(db, ids.otherId, sid, vault)).toBeNull();
    expect(await exportEntries(db, ids.otherId, campus, "production", vault)).toBeNull();
    expect(await deleteProject(db, ids.otherId, campus)).toBe(false);
    expect(await getProject(db, ids.demoId, campus)).not.toBeNull();
  });
});

describe("secrets", () => {
  it("creates, reveals and audits a secret", async () => {
    const pid = ids.projectIds["Portfolio Site"];
    const res = await createSecret(db, ids.demoId, pid, { key: "SENTRY_DSN", value: "https://abc@sentry.io/1", environment: "production", note: "", rotationDays: 90, expiresOn: null }, vault, TODAY);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.secret.lastRotatedOn).toBe(TODAY);
    expect(await revealSecret(db, ids.demoId, res.secret.id, vault)).toBe("https://abc@sentry.io/1");
    const events = await listEvents(db, ids.demoId, { action: "secret" });
    expect(events.slice(0, 2).map((e) => e.action)).toEqual(["secret.reveal", "secret.create"]);
  });
  it("refuses a duplicate key in the same environment", async () => {
    const pid = ids.projectIds["Campus Pay API"];
    const res = await createSecret(db, ids.demoId, pid, { key: "JWT_SECRET", value: "x", environment: "production", note: "", rotationDays: 90, expiresOn: null }, vault, TODAY);
    expect(res).toMatchObject({ ok: false, field: "key" });
  });
  it("treats a new value as a rotation and a note change as an edit", async () => {
    const sid = ids.secretIds["Campus Pay API/production/PAYSTACK_SECRET_KEY"];
    const before = (await getSecret(db, ids.demoId, sid))!;
    const edit = await updateSecret(db, ids.demoId, sid, { note: "changed", rotationDays: 90, expiresOn: null }, vault, TODAY);
    expect(edit).toMatchObject({ ok: true, rotated: false });
    const rot = await updateSecret(db, ids.demoId, sid, { value: "new-rotated-value", note: "changed", rotationDays: 90, expiresOn: null }, vault, TODAY);
    expect(rot).toMatchObject({ ok: true, rotated: true });
    const after = (await getSecret(db, ids.demoId, sid))!;
    expect(after.version).toBe(before.version + 1);
    expect(after.lastRotatedOn).toBe(TODAY);
    expect(await revealSecret(db, ids.demoId, sid, vault)).toBe("new-rotated-value");
    const list = await listSecrets(db, ids.demoId, after.projectId, "production", vault, TODAY);
    expect(list.find((s) => s.id === sid)?.rotation.status).toBe("ok");
  });
  it("flags reused values across environments", async () => {
    const list = await listSecrets(db, ids.demoId, ids.projectIds["Campus Pay API"], "staging", vault, TODAY);
    expect(list.find((s) => s.key === "JWT_SECRET")?.reused).toBe(true);
    expect(list.find((s) => s.key === "DATABASE_URL")?.reused).toBe(false);
  });
  it("cannot decrypt a ciphertext copied into another row", async () => {
    const a = (await getSecret(db, ids.demoId, ids.secretIds["Campus Pay API/production/JWT_SECRET"]))!;
    const b = (await getSecret(db, ids.demoId, ids.secretIds["Campus Pay API/production/REDIS_URL"]))!;
    expect(() => decrypt(a.ciphertext, vault, secretAad(b.projectId, b.environment, b.key))).toThrow();
  });
});

describe("import and export", () => {
  it("imports new keys, skips existing ones and overwrites on request", async () => {
    const pid = ids.projectIds["Hostel Finder"];
    const entries = [{ key: "MAPBOX_TOKEN", value: "pk.changed" }, { key: "SENTRY_DSN", value: "dsn" }];
    const first = await importEntries(db, ids.demoId, pid, "development", entries, false, vault, TODAY);
    expect(first).toMatchObject({ ok: true, added: 1, updated: 0, skipped: 1 });
    const second = await importEntries(db, ids.demoId, pid, "development", entries, true, vault, TODAY);
    expect(second).toMatchObject({ ok: true, added: 0, updated: 1, skipped: 1 });
    const out = await exportEntries(db, ids.demoId, pid, "development", vault);
    expect(out?.entries.find((e) => e.key === "MAPBOX_TOKEN")?.value).toBe("pk.changed");
  });
  it("creates and deletes projects with their secrets", async () => {
    const res = await createProject(db, ids.demoId, { name: "Exam Timetable", description: "" });
    expect(res.ok).toBe(true);
    const dupe = await createProject(db, ids.demoId, { name: "Exam Timetable", description: "" });
    expect(dupe.ok).toBe(false);
    if (!res.ok) return;
    await createSecret(db, ids.demoId, res.project.id, { key: "A", value: "1", environment: "development", note: "", rotationDays: 30, expiresOn: null }, vault, TODAY);
    expect(await deleteProject(db, ids.demoId, res.project.id)).toBe(true);
    const left = await db.select().from(secrets).where(eq(secrets.projectId, res.project.id));
    expect(left).toEqual([]);
  });
});
